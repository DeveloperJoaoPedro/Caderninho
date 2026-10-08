import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCatalog } from "../src/services/catalog.js";
function card(code = "B89331", price = "294.9", href = "https://www.boticario.com.br/produto/lily/") {
  return `<article data-event="{&quot;sku&quot;:&quot;${code}&quot;,&quot;productName&quot;:&quot;Lily Eau de Parfum 75ml&quot;,&quot;price&quot;:${price}}"><a href="${href}">Lily</a></article>`;
}
afterEach(() => vi.restoreAllMocks());
describe("Busca pública de produtos", () => {
  it("extrai centavos exatos e remove duplicatas", () => {
    const products = parseCatalog(card() + card() + card("B10000", "0.29"));
    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({ code: "B89331", priceCents: 29490 });
    expect(products[1].priceCents).toBe(29);
  });
  it("ignora links externos, preços inválidos e cartões quebrados", () => {
    expect(parseCatalog(card("B1", "-1") + card("B2", "1.999") + card("B3", "10", "https://estranho.example/produto/") + '<article data-event="invalid"></article>')).toEqual([]);
  });
  it("valida consulta, limita resultados e não executa scripts", () => {
    expect(parseCatalog('<script>throw new Error()</script>' + Array.from({ length: 20 }, (_, i) => card(`B${i}`)).join(''))).toHaveLength(12);
  });
  it("reutiliza buscas equivalentes e mantém somente o domínio fixo", async () => {
    vi.resetModules();
    const { searchCatalog } = await import("../src/services/catalog.js");
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(card(), { headers: { "content-type": "text/html" } }));
    const first = await searchCatalog(" Lily ");
    expect(await searchCatalog("lily")).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://www.boticario.com.br/busca?q=Lily");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    await expect(searchCatalog("x")).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("distingue nenhum resultado de fonte indisponível", async () => {
    vi.resetModules();
    const { searchCatalog } = await import("../src/services/catalog.js");
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('bloqueado', { status: 403 }))
      .mockResolvedValueOnce(new Response('<html>formato mudou</html>', { headers: { "content-type": "text/html" } }));
    expect((await searchCatalog("inexistente")).products).toEqual([]);
    await expect(searchCatalog("bloqueado")).rejects.toMatchObject({ status: 503 });
    await expect(searchCatalog("mudou")).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("segue código até o produto e extrai o preço dos dados estruturados", async () => {
    vi.resetModules();
    const { searchCatalog } = await import("../src/services/catalog.js");
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Lily Eau de Parfum 75ml", sku: "B89331", url: "https://www.boticario.com.br/produto/lily/", offers: { priceCurrency: "BRL", price: "294.9" } })}</script>`;
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response('', { status: 302, headers: { location: '/produto/lily/' } }))
      .mockResolvedValueOnce(new Response(html, { headers: { "content-type": "text/html" } }));
    expect((await searchCatalog("89331")).products[0]).toMatchObject({ code: "B89331", priceCents: 29490 });
    expect(fetcher.mock.calls[1][0]).toBe("https://www.boticario.com.br/produto/lily/");
  });
  it("bloqueia redirecionamento para outro domínio antes de acessá-lo", async () => {
    vi.resetModules();
    const { searchCatalog } = await import("../src/services/catalog.js");
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
    await expect(searchCatalog("89331")).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
