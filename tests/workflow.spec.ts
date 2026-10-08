import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
const password = "senha-e2e-segura";
test("cadastro, cliente, produto, fiado e pagamento parcial", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const name = "Marina Andrade";
  const email = `marina.e2e.${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta", exact: false }).click();
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Olá, Marina." }),
  ).toBeVisible();
  const mobile = testInfo.project.name === "mobile";
  async function nav(label: string) {
    if (mobile && !["Início", "Vendas", "Fiado"].includes(label))
      await page.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await nav("Minha conta");
  await page.getByLabel("Natura · desconto (%)").fill("30");
  await page.getByRole("button", { name: "Salvar desconto" }).nth(1).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Desconto de Natura atualizado." }),
  ).toBeVisible();
  await nav("Clientes");
  await page.getByRole("button", { name: "Nova cliente", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Rosa Silva");
  await page
    .getByLabel("Telefone com DDD", { exact: false })
    .fill("(11) 99999-1234");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Rosa Silva/ }).first(),
  ).toBeVisible();
  await nav("Produtos");
  await page.getByRole("button", { name: "Novo produto", exact: true }).click();
  await page.getByLabel("Nome do produto").fill("Hidratante de maracujá");
  await page.getByLabel("Preço de catálogo (R$)").fill("100,00");
  await expect(page.getByLabel("Seu custo (R$)", { exact: false })).toHaveValue(
    "70,00",
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hidratante de maracujá" }),
  ).toBeVisible();
  await nav("Vendas");
  await page.getByRole("button", { name: "Nova venda", exact: true }).click();
  await page
    .getByLabel("Para quem é a venda?")
    .selectOption({ label: "Rosa Silva" });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const product = await page.request.get("/api/products");
  const products = await product.json();
  await page.getByLabel("Adicionar produto").selectOption(products[0].id);
  await page.getByRole("button", { name: "Adicionar à venda" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Como a cliente vai pagar?").selectOption("CREDIT");
  await page.getByLabel("Desconto na venda (R$)").fill("10,00");
  await page
    .getByRole("button", { name: "Registrar venda", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Rosa Silva/ }).first(),
  ).toBeVisible();
  await nav("Fiado");
  await expect(page.getByText("R$ 90,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Abrir WhatsApp" }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/5511999991234\?text=/);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await page.getByLabel("Quanto recebeu? (R$)", { exact: false }).fill("30,00");
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByText("R$ 60,00", { exact: true })).toBeVisible();
  await nav("Início");
  await expect(page.getByText("R$ 20,00", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
    animations: "disabled",
  });
  const deletion = await page.request.delete("/api/auth/me", {
    data: { password },
  });
  expect(deletion.status()).toBe(200);
});
