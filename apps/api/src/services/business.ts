import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  saleSchema,
  receiptSchema,
  today,
  splitCents,
  allocateDiscount,
  proportional,
  clientSchema,
  productSchema,
  campaignSchema,
  expenseSchema,
  brandSettingSchema,
  catalogCost,
  reversalSchema,
  cancelSchema,
} from "@caderninho/shared";
import { AppError, requireFound } from "../lib/errors.js";
import {
  businessRepository as repo,
  businessWrites as writes,
} from "../repositories/business.js";
export const dbDate = (s: string) => new Date(s + "T00:00:00.000Z");
export function balance(row: {
  amountCents: number;
  receipts: { amountCents: number; reversal?: unknown }[];
}) {
  return (
    row.amountCents -
    row.receipts.reduce((n, r) => n + (r.reversal ? 0 : r.amountCents), 0)
  );
}
export function decorateInstallment<
  T extends {
    amountCents: number;
    receipts: { amountCents: number; reversal?: unknown }[];
    dueOn: Date;
    sale?: { status?: string };
  },
>(row: T) {
  const remainingCents = balance(row);
  const due = row.dueOn.toISOString().slice(0, 10);
  return {
    ...row,
    remainingCents,
    paidCents: row.amountCents - remainingCents,
    status:
      row.sale?.status === "CANCELLED"
        ? "CANCELLED"
        : remainingCents === 0
          ? "PAID"
          : due < today()
            ? "OVERDUE"
            : due === today()
              ? "TODAY"
              : "PENDING",
  };
}
export async function clients(userId: string, q: string) {
  return (await repo.clients(userId, q)).map((c) => {
    const installments = c.sales
      .filter((s) => s.status === "ACTIVE")
      .flatMap((s) => s.installments);
    const paidCents = installments.reduce(
      (n, p) =>
        n +
        p.receipts.reduce((a, r) => a + (r.reversal ? 0 : r.amountCents), 0),
      0,
    );
    return {
      ...c,
      sales: undefined,
      paidCents,
      openCents: installments.reduce((n, p) => n + balance(p), 0),
      salesCount: c.sales.length,
    };
  });
}
export async function createSale(
  userId: string,
  input: z.infer<typeof saleSchema>,
) {
  if (input.soldOn > today())
    throw new AppError(400, "A venda não pode ter uma data futura.");
  return writes.transaction(userId, async (tx) => {
    requireFound(await tx.client(input.clientId));
    const items = [];
    for (const item of input.items) {
      const product = requireFound(await tx.product(item.productId));
      if (item.campaignId) {
        const campaign = requireFound(await tx.campaign(item.campaignId));
        if (campaign.brand !== product.brand)
          throw new AppError(
            400,
            "O ciclo precisa ser da mesma marca do produto.",
          );
        if (
          input.soldOn < campaign.startsOn.toISOString().slice(0, 10) ||
          input.soldOn > campaign.endsOn.toISOString().slice(0, 10)
        )
          throw new AppError(
            400,
            "A data da venda precisa estar dentro do ciclo.",
          );
      }
      items.push({
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        quantity: item.quantity,
        costCents: product.costCents,
        priceCents: product.priceCents,
        campaignId: item.campaignId ?? null,
      });
    }
    const subtotals = items.map((p) => p.priceCents * p.quantity);
    const subtotalCents = subtotals.reduce((n, v) => n + v, 0);
    if (input.discountCents >= subtotalCents)
      throw new AppError(
        400,
        "O desconto precisa ser menor que o total da venda.",
      );
    const totalCents = subtotalCents - input.discountCents;
    const revenues = allocateDiscount(subtotals, input.discountCents);
    if (
      subtotalCents > 2_000_000_000 ||
      items.some((p) => p.costCents * p.quantity > 2_000_000_000) ||
      totalCents > 2_000_000_000 ||
      totalCents < input.dueDates.length
    )
      throw new AppError(400, "Confira o total e a quantidade de parcelas.");
    const amounts = splitCents(totalCents, input.dueDates.length);
    const sale = await tx.createSale({
      clientId: input.clientId,
      soldOn: dbDate(input.soldOn),
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      subtotalCents,
      discountCents: input.discountCents,
      totalCents,
      items: {
        create: items.map((item, i) => ({
          ...item,
          revenueCents: revenues[i],
        })),
      },
      installments: {
        create: amounts.map((amountCents, i) => ({
          number: i + 1,
          amountCents,
          dueOn: dbDate(input.dueDates[i]),
        })),
      },
    });
    if (input.paymentMethod !== "CREDIT")
      await tx.createReceipt({
        installmentId: sale.installments[0].id,
        amountCents: totalCents,
        paidOn: dbDate(input.soldOn),
        method: input.paymentMethod,
      });
    return tx.sale(sale.id);
  });
}
export async function receive(
  userId: string,
  installmentId: string,
  input: z.infer<typeof receiptSchema>,
) {
  if (input.paidOn > today())
    throw new AppError(400, "O recebimento não pode ter uma data futura.");
  // Serializable impede que dois cliques simultâneos paguem além do saldo.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await writes.transaction(
        userId,
        async (tx) => {
          const row = requireFound(await tx.installment(installmentId));
          if (row.sale.status === "CANCELLED")
            throw new AppError(400, "Esta venda foi cancelada.");
          if (input.paidOn < row.sale.soldOn.toISOString().slice(0, 10))
            throw new AppError(
              400,
              "O recebimento não pode ser anterior à venda.",
            );
          if (input.amountCents > balance(row))
            throw new AppError(
              400,
              "O valor informado é maior que o saldo desta parcela.",
            );
          return tx.createReceipt({
            installmentId,
            amountCents: input.amountCents,
            paidOn: dbDate(input.paidOn),
            method: input.method,
          });
        },
        Prisma.TransactionIsolationLevel.Serializable,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        if (attempt < 2) continue;
        throw new AppError(
          409,
          "Este saldo acabou de mudar. Atualize e tente novamente.",
        );
      }
      throw error;
    }
  }
}
export async function report(userId: string, from: string, to: string) {
  const [sales, expenses, receipts, reversals] = await Promise.all([
    repo.reportSales(userId, dbDate(from), dbDate(to)),
    repo.reportExpenses(userId, dbDate(from), dbDate(to)),
    repo.reportReceipts(userId, dbDate(from), dbDate(to)),
    repo.reportReversals(userId, dbDate(from), dbDate(to)),
  ]);
  const clientMap = new Map<
    string,
    {
      id: string;
      name: string;
      salesCents: number;
      costCents: number;
      marginCents: number;
    }
  >();
  const productMap = new Map<
    string,
    {
      id: string;
      name: string;
      quantity: number;
      salesCents: number;
      costCents: number;
      marginCents: number;
    }
  >();
  let costCents = 0,
    receivedMarginCents = 0;
  for (const sale of sales) {
    const cost = sale.items.reduce((n, i) => n + i.costCents * i.quantity, 0);
    costCents += cost;
    const paid = sale.installments
      .flatMap((p) => p.receipts)
      .filter(
        (r) =>
          r.paidOn <= dbDate(to) &&
          (!r.reversal || r.reversal.reversedOn > dbDate(to)),
      )
      .reduce((n, r) => n + r.amountCents, 0);
    receivedMarginCents += proportional(
      sale.totalCents - cost,
      paid,
      sale.totalCents,
    );
    const c = clientMap.get(sale.clientId) ?? {
      id: sale.clientId,
      name: sale.client.name,
      salesCents: 0,
      costCents: 0,
      marginCents: 0,
    };
    c.salesCents += sale.totalCents;
    c.costCents += cost;
    c.marginCents = c.salesCents - c.costCents;
    clientMap.set(c.id, c);
    for (const item of sale.items) {
      const p = productMap.get(item.productId) ?? {
        id: item.productId,
        name: item.productName,
        quantity: 0,
        salesCents: 0,
        costCents: 0,
        marginCents: 0,
      };
      p.quantity += item.quantity;
      p.salesCents += item.revenueCents;
      p.costCents += item.quantity * item.costCents;
      p.marginCents = p.salesCents - p.costCents;
      productMap.set(p.id, p);
    }
  }
  const salesCents = sales.reduce((n, s) => n + s.totalCents, 0),
    expenseCents = expenses.reduce((n, e) => n + e.amountCents, 0),
    operatingCents = expenses
      .filter((e) => e.category !== "ORDER")
      .reduce((n, e) => n + e.amountCents, 0),
    receivedCents =
      receipts.reduce((n, r) => n + r.amountCents, 0) -
      reversals.reduce((n, r) => n + r.receipt.amountCents, 0);
  // Pedido à marca é saída de caixa. O custo vendido já foi descontado na margem.
  const marginCents = salesCents - costCents;
  return {
    marginCents,
    receivedMarginCents,
    openMarginCents: marginCents - receivedMarginCents,
    from,
    to,
    salesCents,
    costCents,
    expenseCents,
    operatingCents,
    receivedCents,
    profitCents: salesCents - costCents - operatingCents,
    cashCents: receivedCents - expenseCents,
    clients: [...clientMap.values()],
    products: [...productMap.values()],
    salesCount: sales.length,
  };
}
export async function dashboard(userId: string) {
  const day = today();
  const from = day.slice(0, 7) + "-01";
  const end = new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const [month, rows] = await Promise.all([
    report(userId, from, end),
    repo.installments(userId),
  ]);
  const installments = rows.map(decorateInstallment);
  const pending = installments.filter(
    (p) => p.remainingCents > 0 && p.status !== "CANCELLED",
  );
  return {
    ...month,
    openCents: pending.reduce((n, p) => n + p.remainingCents, 0),
    overdueCents: pending
      .filter((p) => p.status === "OVERDUE")
      .reduce((n, p) => n + p.remainingCents, 0),
    debtorCount: new Set(pending.map((p) => p.sale.clientId)).size,
    todayCount: pending.filter((p) => p.status === "TODAY").length,
    upcoming: pending.slice(0, 6),
  };
}

export const createClient = (
  userId: string,
  input: z.infer<typeof clientSchema>,
) => writes.createClient(userId, input);
export const updateClient = (
  userId: string,
  id: string,
  input: z.infer<typeof clientSchema>,
) => writes.updateClient(userId, id, input);
export const archiveClient = (userId: string, id: string) =>
  writes.archiveClient(userId, id);
export const archiveProduct = (userId: string, id: string) =>
  writes.archiveProduct(userId, id);
export async function createProduct(
  userId: string,
  input: z.infer<typeof productSchema>,
) {
  const setting = await writes.brand(userId, input.brand);
  return writes.createProduct(userId, {
    ...input,
    costCents:
      input.costCents ??
      catalogCost(input.catalogCents, setting?.discountBps ?? 0),
  });
}
export async function updateProduct(
  userId: string,
  id: string,
  input: z.infer<typeof productSchema>,
) {
  if (input.costCents === undefined)
    throw new AppError(400, "Informe o custo do produto.");
  return writes.updateProduct(userId, id, {
    ...input,
    costCents: input.costCents,
  });
}
export const updateBrand = (
  userId: string,
  input: z.infer<typeof brandSettingSchema>,
) => writes.updateBrand(userId, input.brand, input.discountBps);
export const createCampaign = (
  userId: string,
  input: z.infer<typeof campaignSchema>,
) =>
  writes.createCampaign(userId, {
    ...input,
    startsOn: dbDate(input.startsOn),
    endsOn: dbDate(input.endsOn),
  });
export async function campaigns(userId: string) {
  return (await repo.campaigns(userId)).map((c) => {
    const active = c.items.filter((i) => i.sale.status === "ACTIVE");
    const salesCents = active.reduce((n, i) => n + i.revenueCents, 0),
      costCents = active.reduce((n, i) => n + i.quantity * i.costCents, 0),
      expenseCents = c.expenses.reduce((n, e) => n + e.amountCents, 0),
      operatingCents = c.expenses
        .filter((e) => e.category !== "ORDER")
        .reduce((n, e) => n + e.amountCents, 0);
    return {
      ...c,
      items: undefined,
      expenses: undefined,
      salesCents,
      costCents,
      expenseCents,
      profitCents: salesCents - costCents - operatingCents,
    };
  });
}
export async function createExpense(
  userId: string,
  input: z.infer<typeof expenseSchema>,
) {
  if (input.spentOn > today())
    throw new AppError(400, "O gasto não pode ter uma data futura.");
  if (input.campaignId) {
    const c = requireFound(await writes.campaign(userId, input.campaignId));
    if (input.brand && input.brand !== c.brand)
      throw new AppError(400, "O ciclo precisa ser da mesma marca do gasto.");
    if (
      input.spentOn < c.startsOn.toISOString().slice(0, 10) ||
      input.spentOn > c.endsOn.toISOString().slice(0, 10)
    )
      throw new AppError(400, "A data do gasto precisa estar dentro do ciclo.");
    input.brand = c.brand;
  }
  return writes.createExpense(userId, {
    ...input,
    spentOn: dbDate(input.spentOn),
  });
}
export async function reverse(
  userId: string,
  receiptId: string,
  input: z.infer<typeof reversalSchema>,
) {
  const receipt = requireFound(await writes.receipt(userId, receiptId));
  if (receipt.reversal)
    throw new AppError(409, "Esse recebimento já foi estornado.");
  if (
    input.reversedOn < receipt.paidOn.toISOString().slice(0, 10) ||
    input.reversedOn > today()
  )
    throw new AppError(
      400,
      "A data do estorno deve estar entre o recebimento e hoje.",
    );
  return writes.reverse(userId, {
    receiptId,
    ...input,
    reversedOn: dbDate(input.reversedOn),
  });
}
export async function cancel(
  userId: string,
  saleId: string,
  input: z.infer<typeof cancelSchema>,
) {
  return writes.transaction(
    userId,
    async (tx) => {
      const sale = requireFound(await tx.sale(saleId));
      if (sale.status === "CANCELLED")
        throw new AppError(409, "Esta venda já foi cancelada.");
      if (sale.installments.some((p) => p.receipts.some((r) => !r.reversal)))
        throw new AppError(
          409,
          "Estorne os recebimentos desta venda antes de cancelar. O histórico será preservado.",
        );
      return tx.cancelSale(saleId, input.reason);
    },
    Prisma.TransactionIsolationLevel.Serializable,
  );
}
export const backup = (userId: string) => writes.backup(userId);
export async function clientDetail(userId: string, id: string) {
  const c = requireFound(await repo.client(userId, id));
  const rows = c.sales
    .filter((s) => s.status === "ACTIVE")
    .flatMap((s) => s.installments);
  return {
    ...c,
    paidCents: rows.reduce(
      (n, p) =>
        n +
        p.receipts.reduce((a, r) => a + (r.reversal ? 0 : r.amountCents), 0),
      0,
    ),
    openCents: rows.reduce((n, p) => n + balance(p), 0),
  };
}
export async function installments(
  userId: string,
  filter: { clientId?: string; status?: string; from?: string; to?: string },
) {
  return (await repo.installments(userId))
    .map(decorateInstallment)
    .filter(
      (r) =>
        (!filter.clientId || r.sale.clientId === filter.clientId) &&
        (!filter.status ||
          (filter.status === "OPEN"
            ? r.remainingCents > 0 && r.status !== "CANCELLED"
            : r.status === filter.status)) &&
        (!filter.from || r.dueOn.toISOString().slice(0, 10) >= filter.from) &&
        (!filter.to || r.dueOn.toISOString().slice(0, 10) <= filter.to),
    );
}
export const products = (userId: string) => repo.products(userId);
export const sales = (userId: string) => repo.sales(userId);
export const expenses = (userId: string) => repo.expenses(userId);
