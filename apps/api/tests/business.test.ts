import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/lib/db.js";
import {
  today,
  splitCents,
  allocateDiscount,
  catalogCost,
  monthlyDates,
  parseMoney,
  clientSchema,
} from "@caderninho/shared";
const a = request.agent(app),
  b = request.agent(app);
const suffix = Date.now();
let userId: string,
  clientId: string,
  productId: string,
  saleId: string,
  installmentId: string,
  receiptId: string;
const email = `marina.${suffix}@example.com`;
const day = today();
beforeAll(async () => {
  const user = await a.post("/api/auth/register").send({
    name: "Marina Andrade",
    email,
    password: "senha-segura-123",
    brands: ["NATURA"],
  });
  expect(user.status).toBe(201);
  userId = user.body.id;
  const other = await b.post("/api/auth/register").send({
    name: "Helena Souza",
    email: `helena.${suffix}@example.com`,
    password: "senha-segura-456",
    brands: ["AVON"],
  });
  expect(other.status).toBe(201);
});
afterAll(async () => {
  await db.$disconnect();
});
describe("Autenticação e dinheiro", () => {
  it("guarda hash, usa cookie HttpOnly e rejeita credenciais incorretas", async () => {
    const raw = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(raw.passwordHash).not.toContain("senha-segura");
    expect(raw.passwordHash).toMatch(/^\$2[ab]\$/);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "errada" });
    expect(login.status).toBe(401);
    const good = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "senha-segura-123" });
    expect(good.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(good.body.passwordHash).toBeUndefined();
  });
  it("exige sessão e protege origem nas alterações", async () => {
    expect((await request(app).get("/api/clients")).status).toBe(401);
    expect(
      (
        await a
          .post("/api/clients")
          .set("Origin", "https://estranho.example")
          .send({})
      ).status,
    ).toBe(403);
  });
  it("valida dinheiro, divide centavos e calcula desconto sem perder centavos", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("25.90")).toBe(2590);
    expect(() => parseMoney("1.23.456")).toThrow();
    expect(() => parseMoney("2,999")).toThrow();
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(
      allocateDiscount([3333, 3333, 3334], 1001).reduce((n, v) => n + v, 0),
    ).toBe(8999);
    expect(catalogCost(9999, 3000)).toBe(6999);
    expect(monthlyDates("2026-01-31", 3)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
  it("normaliza DDD e telefone e rejeita dados inválidos", async () => {
    expect(
      clientSchema.parse({ name: "Rosa Silva", phone: "(11) 99999-1234" })
        .phone,
    ).toBe("5511999991234");
    expect(
      clientSchema.safeParse({ name: "Rosa", phone: "+449999999999" }).success,
    ).toBe(false);
    const invalid = await a.post("/api/products").send({
      name: "Creme",
      brand: "NATURA",
      priceCents: 25.9,
      costCents: 10,
      catalogCents: 3000,
    });
    expect(invalid.status).toBe(400);
  });
});
describe("Cadastros, vendas e recebimentos", () => {
  it("cria cliente, marca e produto com custo automático", async () => {
    const client = await a.post("/api/clients").send({
      name: "Rosa Silva",
      phone: "(11) 99999-1234",
      notes: "Prefere produtos de maracujá",
    });
    expect(client.status).toBe(201);
    clientId = client.body.id;
    expect(client.body.phone).toBe("5511999991234");
    expect(
      (
        await a
          .put("/api/brand-settings")
          .send({ brand: "NATURA", discountBps: 3000 })
      ).status,
    ).toBe(200);
    const product = await a.post("/api/products").send({
      name: "Hidratante de maracujá",
      brand: "NATURA",
      catalogCents: 10001,
      priceCents: 10001,
    });
    expect(product.status).toBe(201);
    productId = product.body.id;
    expect(product.body.costCents).toBe(7001);
  });
  it("nega leitura, edição e relações com registros de outra usuária", async () => {
    expect((await b.get(`/api/clients/${clientId}`)).status).toBe(404);
    expect(
      (
        await b
          .patch(`/api/clients/${clientId}`)
          .send({ name: "Tentativa", phone: "", notes: "" })
      ).status,
    ).toBe(404);
    expect((await b.get("/api/clients")).body).toEqual([]);
    expect(
      (
        await b.post("/api/sales").send({
          clientId,
          items: [{ productId, quantity: 1 }],
          soldOn: day,
          paymentMethod: "CREDIT",
          dueDates: [day],
        })
      ).status,
    ).toBe(404);
  });
  it("registra desconto, custo histórico e parcelas com soma exata", async () => {
    const sale = await a.post("/api/sales").send({
      clientId,
      items: [{ productId, quantity: 1 }],
      soldOn: day,
      paymentMethod: "CREDIT",
      discountCents: 1000,
      dueDates: [day, day, day],
    });
    expect(sale.status).toBe(201);
    saleId = sale.body.id;
    installmentId = sale.body.installments[0].id;
    expect(sale.body.totalCents).toBe(9001);
    expect(sale.body.items[0].revenueCents).toBe(9001);
    expect(
      sale.body.installments.reduce(
        (n: number, p: { amountCents: number }) => n + p.amountCents,
        0,
      ),
    ).toBe(9001);
    expect(sale.body.items[0].costCents).toBe(7001);
    await a.patch(`/api/products/${productId}`).send({
      name: "Hidratante novo",
      brand: "NATURA",
      catalogCents: 12000,
      costCents: 8000,
      priceCents: 12000,
    });
    const history = await a.get("/api/sales");
    expect(history.body[0].items[0].costCents).toBe(7001);
    expect(history.body[0].items[0].productName).toBe("Hidratante de maracujá");
  });
  it("registra parcial, rejeita excesso e calcula lucro proporcional", async () => {
    const payment = await a
      .post(`/api/installments/${installmentId}/receipts`)
      .send({ amountCents: 1000, paidOn: day, method: "PIX" });
    expect(payment.status).toBe(201);
    receiptId = payment.body.id;
    const rows = await a.get("/api/installments");
    const row = rows.body.find((p: { id: string }) => p.id === installmentId);
    expect(row.remainingCents).toBe(2001);
    expect(row.status).toBe("TODAY");
    expect(
      (
        await a
          .post(`/api/installments/${installmentId}/receipts`)
          .send({ amountCents: 2002, paidOn: day, method: "PIX" })
      ).status,
    ).toBe(400);
    const dashboard = await a.get("/api/dashboard");
    expect(dashboard.body.marginCents).toBe(2000);
    expect(dashboard.body.receivedMarginCents).toBe(222);
    expect(dashboard.body.openMarginCents).toBe(1778);
    expect(dashboard.body.openCents).toBe(8001);
  });
  it("impede pagamentos concorrentes além do saldo", async () => {
    const results = await Promise.all([
      a
        .post(`/api/installments/${installmentId}/receipts`)
        .send({ amountCents: 2001, paidOn: day, method: "PIX" }),
      a
        .post(`/api/installments/${installmentId}/receipts`)
        .send({ amountCents: 2001, paidOn: day, method: "PIX" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
  });
  it("mantém histórico no estorno e exige estorno antes de cancelar", async () => {
    expect(
      (
        await a
          .post(`/api/sales/${saleId}/cancel`)
          .send({ reason: "Cliente desistiu" })
      ).status,
    ).toBe(409);
    expect(
      (
        await b
          .post(`/api/receipts/${receiptId}/reverse`)
          .send({ reason: "Tentativa indevida", reversedOn: day })
      ).status,
    ).toBe(404);
    const rows = await a.get("/api/installments");
    const row = rows.body.find((p: { id: string }) => p.id === installmentId);
    for (const receipt of row.receipts)
      expect(
        (
          await a
            .post(`/api/receipts/${receipt.id}/reverse`)
            .send({ reason: "Devolução para a cliente", reversedOn: day })
        ).status,
      ).toBe(201);
    expect(
      (
        await a
          .post(`/api/receipts/${receiptId}/reverse`)
          .send({ reason: "Segundo estorno", reversedOn: day })
      ).status,
    ).toBe(409);
    expect(
      (
        await a
          .post(`/api/sales/${saleId}/cancel`)
          .send({ reason: "Cliente desistiu" })
      ).status,
    ).toBe(200);
    expect((await a.get("/api/sales")).body[0].status).toBe("CANCELLED");
    expect((await a.get("/api/dashboard")).body.openCents).toBe(0);
    expect(
      (
        await a
          .post(`/api/installments/${installmentId}/receipts`)
          .send({ amountCents: 100, paidOn: day, method: "PIX" })
      ).status,
    ).toBe(400);
  });
  it("registra à vista e distingue compra de estoque das despesas", async () => {
    const paid = await a.post("/api/sales").send({
      clientId,
      items: [{ productId, quantity: 1 }],
      soldOn: day,
      paymentMethod: "PIX",
      dueDates: [day],
      discountCents: 0,
    });
    expect(paid.status).toBe(201);
    expect(paid.body.installments[0].receipts[0].amountCents).toBe(12000);
    for (const [category, amountCents] of [
      ["ORDER", 8000],
      ["SHIPPING", 500],
    ] as const)
      expect(
        (
          await a.post("/api/expenses").send({
            description: "Pedido e entrega",
            category,
            amountCents,
            spentOn: day,
          })
        ).status,
      ).toBe(201);
    const report = await a.get(`/api/reports?from=${day}&to=${day}`);
    expect(report.body.marginCents).toBe(4000);
    expect(report.body.profitCents).toBe(3500);
    expect(report.body.expenseCents).toBe(8500);
    expect(report.body.receivedCents).toBe(12000);
  });
  it("exporta PDF, CSV e apenas os próprios dados sem credenciais", async () => {
    const pdf = await a
      .get(`/api/reports/export?from=${day}&to=${day}&format=pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(data)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
    const csv = await a.get(
      `/api/reports/export?from=${day}&to=${day}&format=csv`,
    );
    expect(csv.text).toContain("Rosa Silva");
    const other = await b.get(
      `/api/reports/export?from=${day}&to=${day}&format=csv`,
    );
    expect(other.text).not.toContain("Rosa Silva");
    const backup = await a.get("/api/backup");
    expect(backup.body.receipts.length).toBeGreaterThan(1);
    expect(backup.body.reversals.length).toBeGreaterThan(0);
    expect(JSON.stringify(backup.body)).not.toContain("passwordHash");
    expect(JSON.stringify(backup.body)).not.toContain("senha-segura");
    expect((await b.get("/api/backup")).body.clients).toEqual([]);
  });
  it("exclui conta com dependências e revoga acesso", async () => {
    expect(
      (await a.delete("/api/auth/me").send({ password: "errada" })).status,
    ).toBe(400);
    expect(
      (await a.delete("/api/auth/me").send({ password: "senha-segura-123" }))
        .status,
    ).toBe(200);
    expect((await a.get("/api/clients")).status).toBe(401);
    expect(await db.client.count({ where: { userId } })).toBe(0);
    expect(await db.receiptReversal.count({ where: { userId } })).toBe(0);
  });
});

describe("Recuperação e campanhas", () => {
  it("envia recuperação por SMTP, consome uma vez e invalida a sessão anterior", async () => {
    const c = request.agent(app);
    const address = `recuperacao.${suffix}@example.com`;
    expect(
      (
        await c.post("/api/auth/register").send({
          name: "Camila Souza",
          email: address,
          password: "senha-antiga-123",
          brands: ["NATURA"],
        })
      ).status,
    ).toBe(201);
    const sent = await c.post("/api/auth/forgot").send({ email: address });
    expect(sent.status).toBe(200);
    const absent = await request(app)
      .post("/api/auth/forgot")
      .send({ email: `ausente.${suffix}@example.com` });
    expect(absent.body.message).toBe(sent.body.message);
    const mailbox = (await (
      await fetch("http://127.0.0.1:8025/api/v1/messages")
    ).json()) as { messages: { ID: string; To: { Address: string }[] }[] };
    const message = mailbox.messages.find((m) =>
      m.To.some((t) => t.Address === address),
    );
    expect(message).toBeDefined();
    const content = (await (
      await fetch(`http://127.0.0.1:8025/api/v1/message/${message!.ID}`)
    ).json()) as { Text: string };
    const token = content.Text.match(/reset=([a-f0-9]{64})/)?.[1];
    expect(token).toHaveLength(64);
    const next = "nova-senha-456";
    expect(
      (await c.post("/api/auth/reset").send({ token, password: next })).status,
    ).toBe(200);
    expect((await c.get("/api/auth/me")).status).toBe(401);
    expect(
      (await c.post("/api/auth/reset").send({ token, password: next })).status,
    ).toBe(400);
    expect(
      (
        await c
          .post("/api/auth/login")
          .send({ email: address, password: "senha-antiga-123" })
      ).status,
    ).toBe(401);
    expect(
      (await c.post("/api/auth/login").send({ email: address, password: next }))
        .status,
    ).toBe(200);
    expect(
      (await c.delete("/api/auth/me").send({ password: next })).status,
    ).toBe(200);
  });
  it("associa campanhas da mesma marca e mantém vendas canceladas fora do resultado", async () => {
    const c = request.agent(app);
    await c.post("/api/auth/register").send({
      name: "Luana Reis",
      email: `ciclo.${suffix}@example.com`,
      password: "senha-ciclo-123",
      brands: ["AVON"],
    });
    const client = await c
      .post("/api/clients")
      .send({ name: "Ana Paula", phone: "" });
    const product = await c.post("/api/products").send({
      name: "Batom vermelho",
      brand: "AVON",
      catalogCents: 3000,
      priceCents: 3000,
      costCents: 2000,
    });
    const campaign = await c.post("/api/campaigns").send({
      name: "Ciclo de outubro",
      brand: "AVON",
      startsOn: day,
      endsOn: day,
    });
    expect(campaign.status).toBe(201);
    const other = await c.post("/api/campaigns").send({
      name: "Ciclo Natura",
      brand: "NATURA",
      startsOn: day,
      endsOn: day,
    });
    const input = {
      clientId: client.body.id,
      items: [
        { productId: product.body.id, quantity: 1, campaignId: other.body.id },
      ],
      soldOn: day,
      paymentMethod: "CREDIT",
      dueDates: [day],
      discountCents: 100,
    };
    expect((await c.post("/api/sales").send(input)).status).toBe(400);
    input.items[0].campaignId = campaign.body.id;
    const sale = await c.post("/api/sales").send(input);
    expect(sale.status).toBe(201);
    await c.post("/api/expenses").send({
      description: "Embalagem do ciclo",
      category: "PACKAGING",
      amountCents: 100,
      spentOn: day,
      campaignId: campaign.body.id,
    });
    const cycles = await c.get("/api/campaigns");
    expect(
      cycles.body.find((r: { id: string }) => r.id === campaign.body.id)
        .profitCents,
    ).toBe(800);
    await c
      .post(`/api/sales/${sale.body.id}/cancel`)
      .send({ reason: "Cliente cancelou" });
    const cancelled = await c.get("/api/campaigns");
    expect(
      cancelled.body.find((r: { id: string }) => r.id === campaign.body.id)
        .profitCents,
    ).toBe(-100);
    await c.delete("/api/auth/me").send({ password: "senha-ciclo-123" });
  });
});
