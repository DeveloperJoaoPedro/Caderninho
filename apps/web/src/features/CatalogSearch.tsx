import { useState } from "react";
import { z } from "zod";
import { money } from "@caderninho/shared";
import { api } from "../lib/api";
import { Button, ErrorBox, Field } from "../components/ui";
const querySchema = z.string().trim().min(2, "Digite pelo menos 2 caracteres.").max(100);
export interface CatalogChoice { code: string; name: string; priceCents: number; sourceUrl: string }
export function CatalogSearch({ onChoose }: { onChoose: (product: CatalogChoice, checkedAt: string) => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ products: CatalogChoice[]; checkedAt: string }>();
  async function search() {
    setError(""); setResult(undefined);
    try {
      const q = querySchema.parse(query);
      setBusy(true);
      setResult(await api(`/catalog/boticario?q=${encodeURIComponent(q)}`));
    } catch (e) {
      setError(e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Não foi possível buscar.");
    } finally { setBusy(false); }
  }
  return <section className="catalog-search" aria-label="Buscar no Boticário">
    <h3>Buscar no Boticário</h3>
    <p>Preencha o produto pelo nome ou código. O preço da loja pode ser diferente do seu catálogo.</p>
    <Field label="Nome ou código no Boticário">
      <input value={query} maxLength={100} placeholder="Ex.: Lily ou 89331" disabled={busy}
        onChange={(e) => { setQuery(e.target.value); setResult(undefined); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!busy) void search(); } }} />
    </Field>
    <Button type="button" variant="secondary" disabled={busy} onClick={() => void search()}>
      {busy ? "Buscando…" : "Buscar produto"}
    </Button>
    <div aria-live="polite">{busy && <p>A consulta pode levar alguns segundos.</p>}
      {result && !result.products.length && <p>Nenhum produto encontrado. Tente outro nome ou preencha abaixo.</p>}
      {result && result.products.length > 0 && <p>Escolha um produto para preencher o cadastro:</p>}
    </div>
    <ErrorBox message={error} />
    <div className="catalog-results">{result?.products.map((product) =>
      <button type="button" className="catalog-choice" key={product.code} onClick={() => {
        onChoose(product, result.checkedAt); setResult(undefined);
      }}>
        <strong>{product.name}</strong>
        <span>{product.code} · {money(product.priceCents)}</span>
        <span>Usar este produto</span>
      </button>)}</div>
  </section>;
}
