import { useState } from "react";
import {
  brands,
  brandNames,
  expenseNames,
  expenseSchema,
  campaignSchema,
  parseMoney,
  money,
  dateLabel,
  today,
} from "@caderninho/shared";
import { api } from "../lib/api";
import type { Expense, Campaign } from "../lib/types";
import { AddButton, Empty, Modal, Field, AsyncForm } from "../components/ui";
export function Expenses({
  rows,
  onNew,
}: {
  rows: Expense[];
  onNew: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meus gastos</h1>
          <p>As pequenas despesas também fazem parte do negócio.</p>
        </div>
        <AddButton onClick={onNew}>Registrar gasto</AddButton>
      </div>
      {rows.length ? (
        <div className="panel row-list">
          {rows.map((e) => (
            <div className="history-row" key={e.id}>
              <div>
                <strong>{e.description}</strong>
                <p>
                  {expenseNames[e.category]} · {dateLabel(e.spentOn)}
                  {e.campaign && ` · ${e.campaign.name}`}
                </p>
              </div>
              <strong>{money(e.amountCents)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Cada gasto tem seu lugar"
          description="Registre pedidos, fretes, embalagens e outros gastos para acompanhar o resultado."
          action={<AddButton onClick={onNew}>Registrar gasto</AddButton>}
        />
      )}
      <p className="note">
        Pedidos à marca entram nos gastos e no fluxo de caixa. O custo dos
        produtos vendidos já é descontado no lucro das vendas.
      </p>
    </>
  );
}
export function ExpenseForm({
  campaigns,
  onDone,
  onClose,
}: {
  campaigns: Campaign[];
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(""),
    [category, setCategory] = useState("SHIPPING"),
    [amount, setAmount] = useState(""),
    [spentOn, setSpentOn] = useState(today()),
    [brand, setBrand] = useState(""),
    [campaignId, setCampaignId] = useState("");
  return (
    <Modal title="Registrar gasto" onClose={onClose}>
      <AsyncForm
        onSubmit={async () => {
          await api(
            "/expenses",
            "POST",
            expenseSchema.parse({
              description,
              category,
              amountCents: parseMoney(amount),
              spentOn,
              brand: brand || null,
              campaignId: campaignId || null,
            }),
          );
          await onDone();
        }}
      >
        <Field label="O que você pagou?">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Frete do pedido Natura"
            required
          />
        </Field>
        <Field label="Categoria">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.entries(expenseNames).map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Valor (R$)">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              required
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Marca (opcional)">
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setCampaignId("");
            }}
          >
            <option value="">Sem marca</option>
            {brands.map((b) => (
              <option value={b} key={b}>
                {brandNames[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ciclo (opcional)">
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Sem ciclo</option>
            {campaigns
              .filter(
                (c) =>
                  (!brand || c.brand === brand) &&
                  c.startsOn.slice(0, 10) <= spentOn &&
                  c.endsOn.slice(0, 10) >= spentOn,
              )
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {brandNames[c.brand]} · {c.name}
                </option>
              ))}
          </select>
        </Field>
      </AsyncForm>
    </Modal>
  );
}
export function Campaigns({
  rows,
  onNew,
}: {
  rows: Campaign[];
  onNew: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meus ciclos</h1>
          <p>Acompanhe o resultado de cada campanha.</p>
        </div>
        <AddButton onClick={onNew}>Novo ciclo</AddButton>
      </div>
      {rows.length ? (
        <div className="product-grid">
          {rows.map((c) => (
            <article className="product-card" key={c.id}>
              <span className="brand-tag">{brandNames[c.brand]}</span>
              <h2>{c.name}</h2>
              <p>
                {dateLabel(c.startsOn)} a {dateLabel(c.endsOn)}
              </p>
              <dl className="cycle-summary">
                <div>
                  <dt>Vendas</dt>
                  <dd>{money(c.salesCents)}</dd>
                </div>
                <div>
                  <dt>Custo vendido</dt>
                  <dd>{money(c.costCents)}</dd>
                </div>
                <div>
                  <dt>Gastos totais</dt>
                  <dd>{money(c.expenseCents)}</dd>
                </div>
                <div className="cycle-profit">
                  <dt>Lucro líquido</dt>
                  <dd>{money(c.profitCents)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Uma campanha de cada vez"
          description="Crie um ciclo e associe produtos vendidos e gastos para ver o resultado."
          action={<AddButton onClick={onNew}>Criar ciclo</AddButton>}
        />
      )}
      <p className="note">
        Lucro líquido = vendas após descontos − custo vendido − despesas
        operacionais. Pedidos à marca não são descontados duas vezes.
      </p>
    </>
  );
}
export function CampaignForm({
  onDone,
  onClose,
}: {
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(""),
    [brand, setBrand] = useState("NATURA"),
    [startsOn, setStartsOn] = useState(today()),
    [endsOn, setEndsOn] = useState(today());
  return (
    <Modal title="Novo ciclo" onClose={onClose}>
      <AsyncForm
        onSubmit={async () => {
          await api(
            "/campaigns",
            "POST",
            campaignSchema.parse({ name, brand, startsOn, endsOn }),
          );
          await onDone();
        }}
      >
        <Field label="Nome do ciclo">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex.: Ciclo 15 · Dia das Mães"
          />
        </Field>
        <Field label="Marca">
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            {brands.map((b) => (
              <option key={b} value={b}>
                {brandNames[b]}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Início">
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              required
            />
          </Field>
          <Field label="Fim">
            <input
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              required
            />
          </Field>
        </div>
      </AsyncForm>
    </Modal>
  );
}
