import { z } from "zod";
import { parseMoney } from "@caderninho/shared";
import { AppError } from "../lib/errors.js";

export const catalogQuery = z.string().trim().min(2, "Digite pelo menos 2 caracteres.").max(100);
export interface CatalogProduct {
  code: string;
  name: string;
  priceCents: number;
  sourceUrl: string;
}
const origin = "https://www.boticario.com.br";
const decode = (s: string) => s.replace(/&(?:quot|amp|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
  const named: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  if (named[entity]) return named[entity];
  const n = entity.startsWith("&#x") ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
});

// Extraímos apenas os cartões de produto, sem executar scripts do site.
export function parseCatalog(html: string): CatalogProduct[] {
  const result = new Map<string, CatalogProduct>();
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const event = match[1].match(/\bdata-event="([^"]*)"/i)?.[1];
    if (!event) continue;
    try {
      const raw = decode(event);
      const data = z.object({ sku: z.string().max(40), productName: z.string().min(2).max(150) }).parse(JSON.parse(raw));
      // Lemos o decimal como texto e convertemos para centavos sem multiplicar floats.
      const amount = raw.match(/"price"\s*:\s*(\d+(?:\.\d{1,2})?)(?=\s*[,}])/)?.[1];
      const href = match[2].match(/<a\b[^>]*\bhref="([^"]*)"/i)?.[1];
      if (!amount || !href) continue;
      const url = new URL(decode(href), origin);
      if (url.origin !== origin || !url.pathname.startsWith("/produto/")) continue;
      const priceCents = parseMoney(amount);
      if (priceCents <= 0 || priceCents > 100_000_000) continue;
      result.set(data.sku, { code: data.sku, name: data.productName, priceCents, sourceUrl: url.href });
    } catch { /* Um cartão inválido não impede usar os demais. */ }
    if (result.size >= 12) break;
  }
  if (result.size) return [...result.values()];
  // Uma busca por código pode abrir diretamente a página de um produto.
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(match[1]);
      for (const item of Array.isArray(json) ? json : [json]) {
        const parsed = z.object({
          "@type": z.literal("Product"), name: z.string().min(2).max(150),
          sku: z.string().max(40), url: z.string().url(),
          offers: z.object({ priceCurrency: z.literal("BRL"), price: z.union([z.string(), z.number()]) }),
        }).safeParse(item);
        if (!parsed.success) continue;
        const p = parsed.data;
        const url = new URL(p.url);
        if (url.origin !== origin || !url.pathname.startsWith("/produto/")) continue;
        const priceCents = parseMoney(String(p.offers.price));
        if (priceCents <= 0 || priceCents > 100_000_000) continue;
        result.set(p.sku, { code: p.sku, name: p.name, priceCents, sourceUrl: url.href });
      }
    } catch { /* Dados estruturados ausentes ou inválidos: usar cadastro manual. */ }
  }
  return [...result.values()];
}

type CatalogResult = { products: CatalogProduct[]; checkedAt: string };
const cache = new Map<string, { expires: number; value: CatalogResult }>();
const pending = new Map<string, Promise<CatalogResult>>();
export async function searchCatalog(input: string): Promise<CatalogResult> {
  const q = catalogQuery.parse(input);
  const key = q.toLocaleLowerCase("pt-BR");
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (pending.has(key)) return pending.get(key)!;
  if (pending.size >= 2) throw new AppError(503, "A busca está ocupada. Aguarde alguns segundos ou cadastre manualmente.");
  const task = (async () => {
    try {
      // Domínio fixo: a usuária não pode fornecer uma URL. Buscas por código
      // redirecionam para o produto; seguimos no máximo 3 saltos no mesmo domínio.
      const signal = AbortSignal.timeout(12_000);
      let url = new URL(`${origin}/busca?q=${encodeURIComponent(q)}`);
      let response: Response;
      for (let hops = 0; ; hops++) {
        response = await fetch(url.href, {
          signal, redirect: "manual",
          headers: { "User-Agent": "Caderninho/0.1 (+product-search)", Accept: "text/html" },
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || hops >= 3) throw new Error("source-redirect");
        url = new URL(location, url);
        if (url.origin !== origin || url.username || url.password) throw new Error("source-redirect");
      }
      if (response.status === 404) return { products: [], checkedAt: new Date().toISOString() };
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("source-unavailable");
      // Limite real de tamanho, inclusive quando não há Content-Length.
      const reader = response.body!.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 3_000_000) { await reader.cancel(); throw new Error("source-too-large"); }
        chunks.push(value);
      }
      const html = Buffer.concat(chunks).toString("utf8");
      const products = parseCatalog(html);
      if (!products.length && !/nenhum produto|não encontramos|nao encontramos/i.test(html)) throw new Error("source-format-changed");
      const value = { products, checkedAt: new Date().toISOString() };
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 60 * 60 * 1000, value });
      return value;
    } catch {
      throw new AppError(503, "Não conseguimos consultar o Boticário agora. Tente mais tarde ou preencha o produto manualmente.");
    }
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
