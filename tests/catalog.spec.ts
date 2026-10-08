import { test, expect } from "@playwright/test";
const password = "senha-catalogo-segura";
test("busca, revisão e cadastro por código, com alternativa manual", async ({ page }, info) => {
  const email = `catalogo.${info.project.name}.${Date.now()}@example.com`;
  const register = await page.request.post('/api/auth/register', { data: { name: 'Marina Oliveira', email, password, brands: ['BOTICARIO'] } });
  expect(register.status()).toBe(201);
  try {
    await page.request.put('/api/brand-settings', { data: { brand: 'BOTICARIO', discountBps: 3000 } });
    await page.goto('/');
    if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Mais', exact: true }).click();
    await page.getByRole('button', { name: 'Produtos', exact: true }).click();
    await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
    await page.route('**/api/catalog/boticario?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Não conseguimos consultar o Boticário agora. Tente mais tarde ou preencha o produto manualmente.' }) }));
    await page.getByLabel('Nome ou código no Boticário').fill('89331');
    await page.getByRole('button', { name: 'Buscar produto', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('preencha o produto manualmente');
    await page.unroute('**/api/catalog/boticario?*');
    await page.route('**/api/catalog/boticario?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ checkedAt: '2026-10-08T12:00:00Z', products: [{ code: 'B89331', name: 'Lily Eau de Parfum 75ml', priceCents: 29490, sourceUrl: 'https://www.boticario.com.br/produto/lily/' }] }) }));
    await page.getByRole('button', { name: 'Buscar produto', exact: true }).click();
    await page.getByRole('button', { name: /Usar este produto/ }).click();
    await expect(page.getByLabel('Nome do produto')).toHaveValue('Lily Eau de Parfum 75ml');
    await expect(page.getByLabel('Código do produto (opcional)')).toHaveValue('B89331');
    await expect(page.getByLabel('Seu custo (R$)', { exact: false })).toHaveValue('206,43');
    await page.getByLabel('Preço de venda (R$)').fill('300,00');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lily Eau de Parfum 75ml' })).toBeVisible();
    await page.getByLabel('Buscar produto', { exact: true }).fill('B89331');
    await expect(page.getByText('Código: B89331')).toBeVisible();
    const products = await (await page.request.get('/api/products')).json();
    expect(products[0]).toMatchObject({ code: 'B89331', catalogCents: 29490, costCents: 20643, priceCents: 30000, brand: 'BOTICARIO' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    expect((await page.request.delete('/api/auth/me', { data: { password } })).status()).toBe(200);
  }
});
