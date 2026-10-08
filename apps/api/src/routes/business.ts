import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { catalogQuery, searchCatalog } from "../services/catalog.js";
import { z } from "zod";
import PDFDocument from "pdfkit";
import {
  id,
  clientSchema,
  productSchema,
  campaignSchema,
  expenseSchema,
  saleSchema,
  receiptSchema,
  periodSchema,
  money,
  dateLabel,
  brandSettingSchema,
  reversalSchema,
  cancelSchema,
  installmentFilterSchema,
} from "@caderninho/shared";
import { auth } from "../middleware/auth.js";
import * as service from "../services/business.js";
export const businessRoutes = Router();
businessRoutes.use(auth);
businessRoutes.get("/catalog/boticario", rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Você fez várias buscas. Aguarde alguns minutos ou cadastre manualmente." },
}), async (req, res) => {
  res.set("Cache-Control", "no-store").json(await searchCatalog(catalogQuery.parse(req.query.q)));
});
const routeId = (value: unknown) => id.parse(value);
const search = (value: unknown) => z.string().max(100).default("").parse(value);
businessRoutes.get("/clients", async (req, res) =>
  res.json(await service.clients(req.userId, search(req.query.q))),
);
businessRoutes.get("/clients/:id", async (req, res) =>
  res.json(await service.clientDetail(req.userId, routeId(req.params.id))),
);
businessRoutes.post("/clients", async (req, res) =>
  res
    .status(201)
    .json(await service.createClient(req.userId, clientSchema.parse(req.body))),
);
businessRoutes.patch("/clients/:id", async (req, res) =>
  res.json(
    await service.updateClient(
      req.userId,
      routeId(req.params.id),
      clientSchema.parse(req.body),
    ),
  ),
);
businessRoutes.delete("/clients/:id", async (req, res) => {
  await service.archiveClient(req.userId, routeId(req.params.id));
  res.json({ ok: true });
});
businessRoutes.get("/products", async (req, res) =>
  res.json(await service.products(req.userId)),
);
businessRoutes.post("/products", async (req, res) =>
  res
    .status(201)
    .json(
      await service.createProduct(req.userId, productSchema.parse(req.body)),
    ),
);
businessRoutes.patch("/products/:id", async (req, res) =>
  res.json(
    await service.updateProduct(
      req.userId,
      routeId(req.params.id),
      productSchema.parse(req.body),
    ),
  ),
);
businessRoutes.delete("/products/:id", async (req, res) => {
  await service.archiveProduct(req.userId, routeId(req.params.id));
  res.json({ ok: true });
});
businessRoutes.get("/sales", async (req, res) =>
  res.json(await service.sales(req.userId)),
);
businessRoutes.post("/sales", async (req, res) =>
  res
    .status(201)
    .json(await service.createSale(req.userId, saleSchema.parse(req.body))),
);
businessRoutes.get("/installments", async (req, res) =>
  res.json(
    await service.installments(
      req.userId,
      installmentFilterSchema.parse(req.query),
    ),
  ),
);
businessRoutes.post("/installments/:id/receipts", async (req, res) =>
  res
    .status(201)
    .json(
      await service.receive(
        req.userId,
        routeId(req.params.id),
        receiptSchema.parse(req.body),
      ),
    ),
);
businessRoutes.get("/campaigns", async (req, res) =>
  res.json(await service.campaigns(req.userId)),
);
businessRoutes.post("/campaigns", async (req, res) =>
  res
    .status(201)
    .json(
      await service.createCampaign(req.userId, campaignSchema.parse(req.body)),
    ),
);
businessRoutes.get("/expenses", async (req, res) =>
  res.json(await service.expenses(req.userId)),
);
businessRoutes.post("/expenses", async (req, res) =>
  res
    .status(201)
    .json(
      await service.createExpense(req.userId, expenseSchema.parse(req.body)),
    ),
);
businessRoutes.get("/dashboard", async (req, res) =>
  res.json(await service.dashboard(req.userId)),
);
businessRoutes.get("/reports", async (req, res) => {
  const p = periodSchema.parse(req.query);
  res.json(await service.report(req.userId, p.from, p.to));
});
// Evita fórmulas ao abrir CSV em Excel ou outros aplicativos de planilha.
const csvCell = (value: unknown) => {
  let s = String(value ?? "");
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
businessRoutes.get("/reports/export", async (req, res) => {
  const p = periodSchema.parse(req.query);
  const format = z.enum(["csv", "pdf"]).parse(req.query.format);
  const report = await service.report(req.userId, p.from, p.to);
  if (format === "csv") {
    const rows = [
      [
        "Tipo",
        "Nome",
        "Vendas (centavos)",
        "Custo (centavos)",
        "Margem (centavos)",
      ],
      ...report.clients.map((c) => [
        "Cliente",
        c.name,
        c.salesCents,
        c.costCents,
        c.marginCents,
      ]),
      ...report.products.map((c) => [
        "Produto",
        c.name,
        c.salesCents,
        c.costCents,
        c.marginCents,
      ]),
      ["Resumo", "Lucro líquido do período", "", "", report.profitCents],
      ["Resumo", "Despesas operacionais", "", "", report.operatingCents],
      ["Resumo", "Gastos totais", "", "", report.expenseCents],
      ["Resumo", "Recebido", "", "", report.receivedCents],
    ];
    res
      .type("text/csv")
      .attachment("caderninho-relatorio.csv")
      .send("\uFEFF" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n"));
    return;
  }
  const doc = new PDFDocument({ margin: 48, size: "A4" });
  res.type("application/pdf").attachment("caderninho-relatorio.pdf");
  doc.pipe(res);
  doc.fontSize(24).text("Caderninho");
  doc
    .moveDown()
    .fontSize(12)
    .text(`Relatório de ${dateLabel(p.from)} a ${dateLabel(p.to)}`);
  doc.moveDown();
  for (const [label, amount] of [
    ["Vendas", report.salesCents],
    ["Custo vendido", report.costCents],
    ["Despesas operacionais", report.operatingCents],
    ["Lucro líquido", report.profitCents],
    ["Recebido", report.receivedCents],
    ["Gastos totais", report.expenseCents],
  ] as const)
    doc.text(`${label}: ${money(amount)}`);
  doc.moveDown().fontSize(15).text("Margem por cliente").fontSize(11);
  for (const c of report.clients)
    doc.text(`${c.name}: ${money(c.marginCents)}`);
  doc.moveDown().fontSize(15).text("Margem por produto").fontSize(11);
  for (const c of report.products)
    doc.text(`${c.name} (${c.quantity} un.): ${money(c.marginCents)}`);
  doc
    .moveDown()
    .fontSize(9)
    .text(
      "Margem por cliente/produto = vendas menos custo vendido. Lucro líquido desconta despesas operacionais. Pedidos à marca são saídas de caixa e não são descontados novamente do lucro.",
    );
  doc.end();
});
businessRoutes.get("/backup", async (req, res) =>
  res
    .attachment("caderninho-backup.json")
    .json(await service.backup(req.userId)),
);

businessRoutes.put("/brand-settings", async (req, res) =>
  res.json(
    await service.updateBrand(req.userId, brandSettingSchema.parse(req.body)),
  ),
);
businessRoutes.post("/receipts/:id/reverse", async (req, res) =>
  res
    .status(201)
    .json(
      await service.reverse(
        req.userId,
        routeId(req.params.id),
        reversalSchema.parse(req.body),
      ),
    ),
);
businessRoutes.post("/sales/:id/cancel", async (req, res) => {
  await service.cancel(
    req.userId,
    routeId(req.params.id),
    cancelSchema.parse(req.body),
  );
  res.json({ ok: true });
});
