import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { accountRepository } from "../repositories/account.js";
import { AppError } from "../lib/errors.js";
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}
export const auth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies.session;
    if (!token) throw new AppError(401, "Entre na sua conta para continuar.");
    let claim: jwt.JwtPayload;
    try {
      claim = jwt.verify(token, config.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, "Sua sessão terminou. Entre novamente.");
    }
    if (typeof claim.sub !== "string")
      throw new AppError(401, "Entre novamente.");
    const user = await accountRepository.session(claim.sub);
    if (!user || user.sessionVersion !== claim.v)
      throw new AppError(401, "Sua sessão terminou. Entre novamente.");
    req.userId = user.id;
    next();
  } catch (error) {
    next(error);
  }
};
