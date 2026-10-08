import { z } from "zod";
export const brands = ["BOTICARIO", "NATURA", "AVON"] as const;
export const brandNames: Record<string, string> = {
  BOTICARIO: "O Boticário",
  NATURA: "Natura",
  AVON: "Avon",
};
export const paymentNames: Record<string, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CARD: "Cartão",
  CREDIT: "Fiado",
};
export const expenseNames: Record<string, string> = {
  ORDER: "Pedido à marca",
  SHIPPING: "Frete",
  PACKAGING: "Embalagem",
  OTHER: "Outros",
};
export const cents = z
  .number()
  .int("Use um valor em centavos.")
  .min(0)
  .max(100_000_000);
export const positiveCents = cents.refine(
  (v) => v > 0,
  "Informe um valor maior que zero.",
);
export const id = z.string().uuid("Registro inválido.");
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Informe uma data válida.");
const password = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "Use até 72 caracteres.")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "A senha pode ter até 72 bytes.",
  );
const email = z
  .string()
  .trim()
  .email("Confira seu e-mail.")
  .max(254)
  .transform((v) => v.toLowerCase());
export const brandSettingSchema = z.object({
  brand: z.enum(brands),
  discountBps: z.number().int().min(0).max(10000),
});
export function catalogCost(catalogCents: number, discountBps: number): number {
  return Number(
    (BigInt(catalogCents) * BigInt(10000 - discountBps) + 5000n) / 10000n,
  );
}
export function proportional(
  value: number,
  part: number,
  total: number,
): number {
  return total === 0
    ? 0
    : Number((BigInt(value) * BigInt(part)) / BigInt(total));
}
export function allocateDiscount(
  subtotals: number[],
  discount: number,
): number[] {
  const total = subtotals.reduce((n, v) => n + v, 0);
  const allocated = subtotals.map((v) => proportional(discount, v, total));
  let remainder = discount - allocated.reduce((n, v) => n + v, 0);
  const order = subtotals
    .map((v, i) => ({ i, r: (BigInt(v) * BigInt(discount)) % BigInt(total) }))
    .sort((a, b) => (a.r > b.r ? -1 : a.r < b.r ? 1 : a.i - b.i));
  for (const v of order) {
    if (remainder-- <= 0) break;
    allocated[v.i]++;
  }
  return subtotals.map((v, i) => v - allocated[i]);
}
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  brands: z
    .array(z.enum(brands))
    .min(1, "Escolha pelo menos uma marca.")
    .max(3)
    .transform((v) => [...new Set(v)]),
});
export const registerSchema = profileSchema.extend({ email, password });
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha.").max(256),
});
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password,
});
export function normalizePhone(value: string): string {
  if (!value) return "";
  const n = value.replace(/\D/g, "");
  if ([10, 11].includes(n.length)) return "55" + n;
  if ([12, 13].includes(n.length) && n.startsWith("55")) return n;
  throw new Error("Informe um telefone brasileiro com DDD.");
}
export const clientSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da cliente.").max(100),
    phone: z
      .string()
      .trim()
      .max(25)
      .refine(
        (v) =>
          !v ||
          (/^\+?[\d\s()\-]+$/.test(v) &&
            ([10, 11].includes(v.replace(/\D/g, "").length) ||
              ([12, 13].includes(v.replace(/\D/g, "").length) &&
                v.replace(/\D/g, "").startsWith("55")))),
        "Informe DDD e telefone.",
      ),
    notes: z.string().trim().max(2000).default(""),
  })
  .transform((v) => ({ ...v, phone: normalizePhone(v.phone) }));
export const productSchema = z.object({
  code: z.string().trim().max(40).default(""),
  name: z.string().trim().min(2, "Informe o nome do produto.").max(150),
  brand: z.enum(brands),
  catalogCents: positiveCents,
  costCents: cents.optional(),
  priceCents: positiveCents,
});
export const campaignSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do ciclo.").max(100),
    brand: z.enum(brands),
    startsOn: date,
    endsOn: date,
  })
  .refine((v) => v.endsOn >= v.startsOn, "O fim precisa ser depois do início.");
export const saleSchema = z
  .object({
    clientId: id,
    soldOn: date,
    paymentMethod: z.enum(["CASH", "PIX", "CARD", "CREDIT"]),
    discountCents: cents.default(0),
    notes: z.string().max(2000).default(""),
    items: z
      .array(
        z.object({
          productId: id,
          quantity: z.number().int().min(1).max(1000),
          campaignId: id.nullable().optional(),
        }),
      )
      .min(1, "Adicione um produto.")
      .max(100),
    dueDates: z.array(date).min(1).max(36),
  })
  .superRefine((v, ctx) => {
    if (
      v.paymentMethod !== "CREDIT" &&
      (v.dueDates.length !== 1 || v.dueDates[0] !== v.soldOn)
    )
      ctx.addIssue({
        code: "custom",
        message: "Pagamento à vista deve vencer no dia da venda.",
        path: ["dueDates"],
      });
    if (
      v.dueDates.some(
        (d, i) => d < v.soldOn || (i > 0 && d < v.dueDates[i - 1]),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Os vencimentos devem estar em ordem e após a venda.",
        path: ["dueDates"],
      });
  });
export const receiptSchema = z.object({
  amountCents: positiveCents,
  paidOn: date,
  method: z.enum(["CASH", "PIX", "CARD"]),
});
export const expenseSchema = z.object({
  description: z.string().trim().min(2, "Descreva o gasto.").max(200),
  category: z.enum(["ORDER", "SHIPPING", "PACKAGING", "OTHER"]),
  amountCents: positiveCents,
  spentOn: date,
  brand: z.enum(brands).nullable().optional(),
  campaignId: id.nullable().optional(),
});
export const periodSchema = z
  .object({ from: date, to: date })
  .refine((v) => v.to >= v.from, "Confira o período.");
export function parseMoney(value: string): number {
  let raw = value.trim().replace(/^R\$\s*/, "");
  // Teclados de celular podem enviar ponto decimal numa tela em português.
  if (raw.includes(".") && !raw.includes(",") && /^\d{1,9}\.\d{1,2}$/.test(raw))
    raw = raw.replace(".", ",");
  if (raw.includes(".") && !/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw))
    throw new Error("Use um valor como 25,90.");
  const s = raw.replace(/\./g, "");
  if (!/^\d{1,9}(,\d{1,2})?$/.test(s))
    throw new Error("Use um valor como 25,90.");
  const [whole, part = ""] = s.split(",");
  const n = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (n > 100_000_000) throw new Error("O valor é muito alto.");
  return n;
}
export function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}
export function today(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}
export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(value.slice(0, 10) + "T12:00:00Z"),
  );
}
export function splitCents(total: number, count: number): number[] {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isInteger(count) ||
    count < 1 ||
    total < count
  )
    throw new Error("Valor insuficiente para dividir em parcelas.");
  const base = Math.floor(total / count);
  return Array.from(
    { length: count },
    (_, i) => base + (i < total % count ? 1 : 0),
  );
}
export function monthlyDates(first: string, count: number): string[] {
  const [y, m, d] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const end = new Date(Date.UTC(y, m + i, 0));
    return new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        Math.min(d, end.getUTCDate()),
      ),
    )
      .toISOString()
      .slice(0, 10);
  });
}

export const reversalSchema = z.object({
  reason: z.string().trim().min(3, "Explique o motivo do estorno.").max(500),
  reversedOn: date,
});
export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Explique o motivo do cancelamento.")
    .max(500),
});
export const installmentFilterSchema = z
  .object({
    clientId: id.optional(),
    status: z
      .enum(["PAID", "OVERDUE", "TODAY", "PENDING", "OPEN", "CANCELLED"])
      .optional(),
    from: date.optional(),
    to: date.optional(),
  })
  .refine((v) => !v.from || !v.to || v.to >= v.from, "Confira o período.");
