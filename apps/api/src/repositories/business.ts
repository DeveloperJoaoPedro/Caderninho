import { db } from "../lib/db.js";
export const saleInclude = {
  client: true,
  items: true,
  installments: {
    include: { receipts: { include: { reversal: true } } },
    orderBy: { number: "asc" as const },
  },
} as const;
// O escopo é obrigatório: não há método de negócio que consulte sem userId.
export const businessRepository = {
  clients: (userId: string, q: string = "") =>
    db.client.findMany({
      where: {
        userId,
        archived: false,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: {
        sales: {
          include: {
            installments: {
              include: { receipts: { include: { reversal: true } } },
            },
          },
        },
      },
    }),
  client: (userId: string, id: string) =>
    db.client.findFirst({
      where: { userId, id },
      include: { sales: { orderBy: { soldOn: "desc" }, include: saleInclude } },
    }),
  products: (userId: string) =>
    db.product.findMany({
      where: { userId, archived: false },
      orderBy: { name: "asc" },
    }),
  sales: (userId: string) =>
    db.sale.findMany({
      where: { userId },
      include: saleInclude,
      orderBy: [{ soldOn: "desc" }, { createdAt: "desc" }],
    }),
  installments: (userId: string) =>
    db.installment.findMany({
      where: { userId },
      include: {
        receipts: { include: { reversal: true } },
        sale: { include: { client: true } },
      },
      orderBy: { dueOn: "asc" },
    }),
  campaigns: (userId: string) =>
    db.campaign.findMany({
      where: { userId },
      include: { items: { include: { sale: true } }, expenses: true },
      orderBy: { startsOn: "desc" },
    }),
  expenses: (userId: string) =>
    db.expense.findMany({
      where: { userId },
      include: { campaign: true },
      orderBy: { spentOn: "desc" },
    }),
  reportSales: (userId: string, from: Date, to: Date) =>
    db.sale.findMany({
      where: { userId, status: "ACTIVE", soldOn: { gte: from, lte: to } },
      include: saleInclude,
      orderBy: { soldOn: "asc" },
    }),
  reportExpenses: (userId: string, from: Date, to: Date) =>
    db.expense.findMany({ where: { userId, spentOn: { gte: from, lte: to } } }),
  reportReversals: (userId: string, from: Date, to: Date) =>
    db.receiptReversal.findMany({
      where: { userId, reversedOn: { gte: from, lte: to } },
      include: { receipt: true },
    }),
  reportReceipts: (userId: string, from: Date, to: Date) =>
    db.receipt.findMany({
      where: { userId, paidOn: { gte: from, lte: to } },
      include: { reversal: true },
    }),
};

import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { clientSchema, productSchema } from "@caderninho/shared";
import { requireFound } from "../lib/errors.js";
function scopedTransaction(userId: string, tx: Prisma.TransactionClient) {
  return {
    client: (id: string) =>
      tx.client.findFirst({ where: { id, userId, archived: false } }),
    product: (id: string) =>
      tx.product.findFirst({ where: { id, userId, archived: false } }),
    campaign: (id: string) => tx.campaign.findFirst({ where: { id, userId } }),
    installment: (id: string) =>
      tx.installment.findFirst({
        where: { id, userId },
        include: { receipts: { include: { reversal: true } }, sale: true },
      }),
    sale: (id: string) =>
      tx.sale.findFirst({ where: { id, userId }, include: saleInclude }),
    createSale: (data: Omit<Prisma.SaleUncheckedCreateInput, "userId">) =>
      tx.sale.create({ data: { ...data, userId }, include: saleInclude }),
    createReceipt: (data: Omit<Prisma.ReceiptUncheckedCreateInput, "userId">) =>
      tx.receipt.create({ data: { ...data, userId } }),
    cancelSale: (id: string, reason: string) =>
      tx.sale.update({
        where: { userId_id: { userId, id } },
        data: {
          status: "CANCELLED",
          cancelReason: reason,
          cancelledAt: new Date(),
        },
      }),
  };
}
export const businessWrites = {
  transaction: <T>(
    userId: string,
    work: (repo: ReturnType<typeof scopedTransaction>) => Promise<T>,
    isolationLevel?: Prisma.TransactionIsolationLevel,
  ) =>
    db.$transaction((tx) => work(scopedTransaction(userId, tx)), {
      isolationLevel,
    }),
  createClient: (userId: string, data: z.infer<typeof clientSchema>) =>
    db.client.create({ data: { ...data, userId } }),
  updateClient: (
    userId: string,
    id: string,
    data: z.infer<typeof clientSchema>,
  ) => db.client.update({ where: { userId_id: { userId, id } }, data }),
  archiveClient: async (userId: string, id: string) => {
    requireFound(await db.client.findFirst({ where: { userId, id } }));
    return db.client.update({
      where: { userId_id: { userId, id } },
      data: { archived: true },
    });
  },
  createProduct: (
    userId: string,
    data: z.infer<typeof productSchema> & { costCents: number },
  ) => db.product.create({ data: { ...data, userId } }),
  updateProduct: (
    userId: string,
    id: string,
    data: z.infer<typeof productSchema> & { costCents: number },
  ) => db.product.update({ where: { userId_id: { userId, id } }, data }),
  archiveProduct: async (userId: string, id: string) => {
    requireFound(await db.product.findFirst({ where: { userId, id } }));
    return db.product.update({
      where: { userId_id: { userId, id } },
      data: { archived: true },
    });
  },
  brand: (userId: string, brand: import("@prisma/client").Brand) =>
    db.userBrand.findUnique({ where: { userId_brand: { userId, brand } } }),
  updateBrand: (
    userId: string,
    brand: import("@prisma/client").Brand,
    discountBps: number,
  ) =>
    db.userBrand.upsert({
      where: { userId_brand: { userId, brand } },
      create: { userId, brand, discountBps },
      update: { discountBps },
    }),
  campaign: (userId: string, id: string) =>
    db.campaign.findFirst({ where: { userId, id } }),
  createCampaign: (
    userId: string,
    data: Omit<Prisma.CampaignUncheckedCreateInput, "userId">,
  ) => db.campaign.create({ data: { ...data, userId } }),
  createExpense: (
    userId: string,
    data: Omit<Prisma.ExpenseUncheckedCreateInput, "userId">,
  ) => db.expense.create({ data: { ...data, userId } }),
  receipt: (userId: string, id: string) =>
    db.receipt.findFirst({
      where: { userId, id },
      include: { reversal: true },
    }),
  reverse: (
    userId: string,
    data: Omit<Prisma.ReceiptReversalUncheckedCreateInput, "userId">,
  ) => db.receiptReversal.create({ data: { ...data, userId } }),
  backup: (userId: string) =>
    db.$transaction(
      async (tx) => {
        const [
          profile,
          clients,
          products,
          campaigns,
          sales,
          items,
          installments,
          receipts,
          expenses,
          brandSettings,
          reversals,
        ] = await Promise.all([
          tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { name: true, email: true, brands: true, createdAt: true },
          }),
          tx.client.findMany({ where: { userId } }),
          tx.product.findMany({ where: { userId } }),
          tx.campaign.findMany({ where: { userId } }),
          tx.sale.findMany({ where: { userId } }),
          tx.saleItem.findMany({ where: { userId } }),
          tx.installment.findMany({ where: { userId } }),
          tx.receipt.findMany({ where: { userId } }),
          tx.expense.findMany({ where: { userId } }),
          tx.userBrand.findMany({ where: { userId } }),
          tx.receiptReversal.findMany({ where: { userId } }),
        ]);
        return {
          version: 1,
          exportedAt: new Date(),
          profile,
          clients,
          products,
          campaigns,
          sales,
          items,
          installments,
          receipts,
          expenses,
          brandSettings,
          reversals,
        };
      },
      { isolationLevel: "RepeatableRead" },
    ),
};
