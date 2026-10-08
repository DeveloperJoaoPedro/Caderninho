import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  resetSchema,
  profileSchema,
} from "@caderninho/shared";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import {
  accountRepository,
  accountWrites as writes,
} from "../repositories/account.js";
const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const mail = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  secure: config.SMTP_SECURE === "true",
  ...(config.SMTP_USER
    ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
    : {}),
});
const dummyHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
export function signSession(user: { id: string; sessionVersion: number }) {
  return jwt.sign({ v: user.sessionVersion }, config.JWT_SECRET, {
    subject: user.id,
    expiresIn: "7d",
    algorithm: "HS256",
  });
}
export async function register(input: z.infer<typeof registerSchema>) {
  if (await accountRepository.byEmail(input.email))
    throw new AppError(
      409,
      "Este e-mail já tem uma conta. Entre ou recupere sua senha.",
    );
  const user = await writes.create({
    name: input.name,
    email: input.email,
    brands: input.brands,
    passwordHash: await bcrypt.hash(input.password, 12),
  });
  return { user: await writes.public(user.id), token: signSession(user) };
}
export async function login(input: z.infer<typeof loginSchema>) {
  const user = await accountRepository.byEmail(input.email);
  const valid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? dummyHash,
  );
  if (!user || !valid)
    throw new AppError(
      401,
      "E-mail ou senha incorretos. Confira e tente novamente.",
    );
  return { user: await writes.public(user.id), token: signSession(user) };
}
export async function forgot(email: string) {
  const user = await accountRepository.byEmail(email);
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  const row = await writes.createReset(
    user.id,
    hashToken(token),
    new Date(Date.now() + 30 * 60 * 1000),
  );
  try {
    await mail.sendMail({
      from: config.SMTP_FROM,
      to: user.email,
      subject: "Crie uma nova senha · Caderninho",
      text: `Você pediu uma nova senha. Abra este link em até 30 minutos:\n${config.APP_URL}/?reset=${token}\n\nSe não foi você, ignore este e-mail.`,
    });
  } catch {
    await writes.deleteReset(user.id, row.id);
    throw new AppError(
      503,
      "Não conseguimos enviar o e-mail agora. Tente novamente mais tarde.",
    );
  }
}
export async function reset(input: z.infer<typeof resetSchema>) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const row = await writes.resetRecord(hashToken(input.token));
  if (!row || row.usedAt || row.expiresAt < new Date())
    throw new AppError(400, "Este link expirou ou já foi usado. Peça um novo.");
  if (!(await writes.consumeReset(row.userId, row.id, passwordHash)))
    throw new AppError(400, "Este link já foi usado. Peça um novo.");
}
export const me = (userId: string) => writes.public(userId);
export const profile = (userId: string, input: z.infer<typeof profileSchema>) =>
  writes.profile(userId, input);
export async function deleteAccount(userId: string, password: string) {
  const user = await writes.private(userId);
  if (!(await bcrypt.compare(password, user.passwordHash)))
    throw new AppError(400, "Confira sua senha para confirmar a exclusão.");
  await writes.delete(userId);
}
