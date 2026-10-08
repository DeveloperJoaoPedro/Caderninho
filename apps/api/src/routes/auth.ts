import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
  profileSchema,
} from "@caderninho/shared";
import * as service from "../services/auth.js";
import { auth } from "../middleware/auth.js";
import { config } from "../lib/config.js";
export const authRoutes = Router();
const cookie = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  },
});
authRoutes.post("/register", limiter, async (req, res) => {
  const result = await service.register(registerSchema.parse(req.body));
  res.cookie("session", result.token, cookie).status(201).json(result.user);
});
authRoutes.post("/login", limiter, async (req, res) => {
  const result = await service.login(loginSchema.parse(req.body));
  res.cookie("session", result.token, cookie).json(result.user);
});
authRoutes.post("/forgot", limiter, async (req, res) => {
  await service.forgot(forgotSchema.parse(req.body).email);
  res.json({
    message:
      "Se esse e-mail tiver uma conta, você receberá um link para criar uma nova senha.",
  });
});
authRoutes.post("/reset", limiter, async (req, res) => {
  await service.reset(resetSchema.parse(req.body));
  res
    .clearCookie("session", { ...cookie, maxAge: undefined })
    .json({ message: "Senha alterada. Entre com sua nova senha." });
});
authRoutes.post("/logout", (_req, res) =>
  res
    .clearCookie("session", { ...cookie, maxAge: undefined })
    .json({ ok: true }),
);
authRoutes.get("/me", auth, async (req, res) =>
  res.json(await service.me(req.userId)),
);
authRoutes.patch("/me", auth, async (req, res) =>
  res.json(await service.profile(req.userId, profileSchema.parse(req.body))),
);
authRoutes.delete("/me", auth, async (req, res) => {
  const { password } = z
    .object({ password: z.string().min(1).max(256) })
    .parse(req.body);
  await service.deleteAccount(req.userId, password);
  res
    .clearCookie("session", { ...cookie, maxAge: undefined })
    .json({ ok: true });
});
