import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "./lib/config.js";
import { isAllowedOrigin } from "./lib/app-url.js";
import { db } from "./lib/db.js";
import { AppError } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { businessRoutes } from "./routes/business.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());
app.use((req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!isAllowedOrigin(req.get("origin"), req.get("sec-fetch-site"), config.APP_URL, process.env))
      return next(new AppError(403, "Requisição não permitida."));
  }
  next();
});
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});
app.use("/api/auth", authRoutes);
app.use("/api", businessRoutes);
app.use((_req, _res, next) =>
  next(new AppError(404, "Página não encontrada.")),
);
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .json({
        message: error.issues[0]?.message ?? "Confira os campos.",
        issues: error.flatten(),
      });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({ message: "Esse registro já existe." });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    res
      .status(409)
      .json({
        message: "Este registro acabou de mudar. Atualize e tente novamente.",
      });
    return;
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    res.status(404).json({ message: "Não encontramos esse registro." });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res
      .status(400)
      .json({ message: "Dados inválidos. Confira e tente novamente." });
    return;
  }
  console.error(
    "Falha interna:",
    error instanceof Error ? error.name : "desconhecida",
  );
  res
    .status(500)
    .json({ message: "Não conseguimos concluir agora. Tente novamente." });
};
app.use(errors);
