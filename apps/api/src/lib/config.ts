import dotenv from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { resolveAppUrl } from "./app-url.js";
dotenv.config({
  path: existsSync(resolve(process.cwd(), ".env"))
    ? resolve(process.cwd(), ".env")
    : resolve(process.cwd(), "../../.env"),
  quiet: true,
});
const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SMTP_HOST: z.string().default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default("Caderninho <nao-responda@caderninho.local>"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
});
export const config = configSchema.parse({
  ...process.env,
  APP_URL: resolveAppUrl(process.env),
});
