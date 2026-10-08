import { db } from "../lib/db.js";
export const publicUser = {
  id: true,
  name: true,
  email: true,
  brands: true,
  createdAt: true,
  brandSettings: true,
} as const;
export const accountRepository = {
  byEmail: (email: string) => db.user.findUnique({ where: { email } }),
  session: (id: string) =>
    db.user.findUnique({
      where: { id },
      select: { ...publicUser, sessionVersion: true },
    }),
};

import type { Prisma } from "@prisma/client";
export const accountWrites = {
  create: (data: Prisma.UserCreateInput) => db.user.create({ data }),
  public: (id: string) =>
    db.user.findUniqueOrThrow({ where: { id }, select: publicUser }),
  profile: (
    id: string,
    data: Pick<Prisma.UserUpdateInput, "name" | "brands">,
  ) => db.user.update({ where: { id }, data, select: publicUser }),
  resetRecord: (tokenHash: string) =>
    db.passwordReset.findUnique({ where: { tokenHash } }),
  createReset: (userId: string, tokenHash: string, expiresAt: Date) =>
    db.passwordReset.create({ data: { userId, tokenHash, expiresAt } }),
  deleteReset: (userId: string, id: string) =>
    db.passwordReset.deleteMany({ where: { userId, id } }),
  consumeReset: (userId: string, id: string, passwordHash: string) =>
    db.$transaction(async (tx) => {
      const consumed = await tx.passwordReset.updateMany({
        where: { id, userId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      await tx.passwordReset.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    }),
  private: (id: string) => db.user.findUniqueOrThrow({ where: { id } }),
  delete: (userId: string) =>
    db.$transaction(async (tx) => {
      await tx.sale.deleteMany({ where: { userId } });
      await tx.expense.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    }),
};
