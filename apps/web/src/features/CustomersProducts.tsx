import { useState } from "react";
import {
  MagnifyingGlass,
  PencilSimple,
  Archive,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  brandNames,
  brands,
  clientSchema,
  productSchema,
  money,
  parseMoney,
  catalogCost,
  dateLabel,
} from "@caderninho/shared";
import { api } from "../lib/api";
import type { Client, Product, User } from "../lib/types";
import {
  AddButton,
  Avatar,
  Empty,
  Field,
  Modal,
  AsyncForm,
  Button,
} from "../components/ui";
export function Clients({
  rows,
  onNew,
  onEdit,
  onView,
}: {
  rows: Client[];
  onNew: () => void;
  onEdit: (row: Client) => void;
  onView: (row: Client) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) =>
    (r.name + " " + r.phone)
      .toLocaleLowerCase("pt-BR")
      .includes(q.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Minhas clientes</h1>
          <p>Quem compra com você, sempre por perto.</p>
        </div>
        <AddButton onClick={onNew}>Nova cliente</AddButton>
      </div>
      <label className="search">
        <MagnifyingGlass size={22} />
        <input
          aria-label="Buscar cliente"
          placeholder="Buscar por nome ou telefone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {filtered.length ? (
        <section className="panel row-list">
          {filtered.map((c) => (
            <div className="customer-row" key={c.id}>
              <button className="customer-info" onClick={() => onView(c)}>
                <Avatar name={c.name} />
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.phone ? `+${c.phone}` : "Sem telefone cadastrado"}
                  </small>
                </span>
              </button>
              <div className="customer-balances">
                <span>
                  <small>Em aberto</small>
                  <strong className={c.openCents ? "attention" : ""}>
                    {money(c.openCents)}
                  </strong>
                </span>
                <span>
                  <small>Já pago</small>
                  <strong>{money(c.paidCents)}</strong>
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={`Editar ${c.name}`}
                onClick={() => onEdit(c)}
              >
                <PencilSimple size={22} />
              </button>
              <button
                className="icon-button"
                aria-label={`Histórico de ${c.name}`}
                onClick={() => onView(c)}
              >
                <ArrowRight size={22} />
              </button>
            </div>
          ))}
        </section>
      ) : (
        <Empty
          title={
            q
              ? "Nenhuma cliente encontrada"
              : "Sua primeira cliente começa aqui"
          }
          description={
            q
              ? "Tente outro nome ou telefone."
              : "Cadastre nome e telefone. O histórico será preenchido a cada venda."
          }
          action={
            !q && <AddButton onClick={onNew}>Cadastrar cliente</AddButton>
          }
        />
      )}
    </>
  );
}
export function ClientForm({
  row,
  onDone,
  onClose,
  onArchive,
}: {
  row?: Client;
  onDone: () => Promise<void>;
  onClose: () => void;
  onArchive?: () => void;
}) {
  const [name, setName] = useState(row?.name ?? ""),
    [phone, setPhone] = useState(row?.phone ?? ""),
    [notes, setNotes] = useState(row?.notes ?? "");
  return (
    <Modal title={row ? "Editar cliente" : "Nova cliente"} onClose={onClose}>
      <AsyncForm
        secondary={
          row && (
            <Button type="button" variant="ghost" onClick={onArchive}>
              <Archive size={18} />
              Arquivar
            </Button>
          )
        }
        onSubmit={async () => {
          await api(
            "/clients" + (row ? "/" + row.id : ""),
            row ? "PATCH" : "POST",
            clientSchema.parse({ name, phone, notes }),
          );
          await onDone();
        }}
      >
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Nome da cliente"
            autoComplete="name"
          />
        </Field>
        <Field
          label="Telefone com DDD"
          hint="Usamos este número para abrir a cobrança no WhatsApp."
        >
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
          />
        </Field>
        <Field label="Observações (opcional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Preferências ou algo que você queira lembrar"
            maxLength={2000}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
export function ClientHistory({
  client,
  onClose,
}: {
  client: Client;
  onClose: () => void;
}) {
  return (
    <Modal
      title={client.name}
      description="Histórico de compras e pagamentos."
      onClose={onClose}
    >
      <div className="summary-pair">
        <span>
          Em aberto<strong>{money(client.openCents)}</strong>
        </span>
        <span>
          Já pago<strong>{money(client.paidCents)}</strong>
        </span>
      </div>
      {client.notes && <p className="note">{client.notes}</p>}
      {client.sales?.length ? (
        <div className="row-list">
          {client.sales.map((s) => (
            <div className="history-row" key={s.id}>
              <div>
                <strong>
                  {dateLabel(s.soldOn)}{" "}
                  {s.status === "CANCELLED" && "· Cancelada"}
                </strong>
                <p>
                  {s.items
                    .map((i) => `${i.quantity}× ${i.productName}`)
                    .join(", ")}
                </p>
              </div>
              <strong>{money(s.totalCents)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Ainda sem compras"
          description="As vendas desta cliente aparecerão aqui."
        />
      )}
    </Modal>
  );
}
export function Products({
  rows,
  onNew,
  onEdit,
}: {
  rows: Product[];
  onNew: () => void;
  onEdit: (row: Product) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meus produtos</h1>
          <p>Preço, custo e lucro. Tudo sem fazer contas.</p>
        </div>
        <AddButton onClick={onNew}>Novo produto</AddButton>
      </div>
      <label className="search">
        <MagnifyingGlass size={22} />
        <input
          aria-label="Buscar produto"
          placeholder="Buscar produto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {filtered.length ? (
        <div className="product-grid">
          {filtered.map((p) => (
            <article className="product-card" key={p.id}>
              <span className="brand-tag">{brandNames[p.brand]}</span>
              <h2>{p.name}</h2>
              <div className="product-prices">
                <span>
                  Custo<strong>{money(p.costCents)}</strong>
                </span>
                <span>
                  Venda<strong>{money(p.priceCents)}</strong>
                </span>
              </div>
              <div className="product-margin">
                <span>
                  Lucro por unidade
                  <strong>
                    {money(p.priceCents - p.costCents)}{" "}
                    <small>
                      (
                      {(((p.priceCents - p.costCents) * 100) / p.priceCents)
                        .toFixed(1)
                        .replace(".", ",")}
                      %)
                    </small>
                  </strong>
                </span>
                <button
                  className="icon-button"
                  onClick={() => onEdit(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  <PencilSimple size={22} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={q ? "Nenhum produto encontrado" : "Seu catálogo, do seu jeito"}
          description="Cadastre os produtos que você vende para agilizar suas próximas vendas."
          action={
            !q && <AddButton onClick={onNew}>Cadastrar produto</AddButton>
          }
        />
      )}
    </>
  );
}
export function ProductForm({
  row,
  user,
  onDone,
  onClose,
  onArchive,
}: {
  row?: Product;
  user: User;
  onDone: () => Promise<void>;
  onClose: () => void;
  onArchive?: () => void;
}) {
  const [name, setName] = useState(row?.name ?? ""),
    [brand, setBrand] = useState(row?.brand ?? user.brands[0] ?? "NATURA"),
    [catalog, setCatalog] = useState(
      row ? (row.catalogCents / 100).toFixed(2).replace(".", ",") : "",
    ),
    [cost, setCost] = useState(
      row ? (row.costCents / 100).toFixed(2).replace(".", ",") : "",
    ),
    [price, setPrice] = useState(
      row ? (row.priceCents / 100).toFixed(2).replace(".", ",") : "",
    ),
    [manual, setManual] = useState(!!row),
    [priceManual, setPriceManual] = useState(!!row);
  const discount =
    user.brandSettings?.find((b) => b.brand === brand)?.discountBps ?? 0;
  function autoCost(value: string, b = brand) {
    if (manual) return;
    try {
      const d =
        user.brandSettings?.find((x) => x.brand === b)?.discountBps ?? 0;
      setCost(
        (catalogCost(parseMoney(value), d) / 100).toFixed(2).replace(".", ","),
      );
    } catch {
      setCost("");
    }
  }
  let margin: string = "";
  try {
    margin = money(parseMoney(price) - parseMoney(cost));
  } catch {}
  return (
    <Modal title={row ? "Editar produto" : "Novo produto"} onClose={onClose}>
      <AsyncForm
        secondary={
          row && (
            <Button type="button" variant="ghost" onClick={onArchive}>
              <Archive size={18} />
              Arquivar
            </Button>
          )
        }
        onSubmit={async () => {
          await api(
            "/products" + (row ? "/" + row.id : ""),
            row ? "PATCH" : "POST",
            productSchema.parse({
              name,
              brand,
              catalogCents: parseMoney(catalog),
              costCents: parseMoney(cost),
              priceCents: parseMoney(price),
            }),
          );
          await onDone();
        }}
      >
        <Field label="Nome do produto">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ex.: Hidratante de maracujá"
          />
        </Field>
        <Field label="Marca">
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              autoCost(catalog, e.target.value);
            }}
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {brandNames[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preço de catálogo (R$)">
          <input
            inputMode="decimal"
            value={catalog}
            onChange={(e) => {
              setCatalog(e.target.value);
              autoCost(e.target.value);
              if (!priceManual) setPrice(e.target.value);
            }}
            required
            placeholder="0,00"
          />
        </Field>
        <div className="two-fields">
          <Field
            label="Seu custo (R$)"
            hint={`Desconto padrão: ${(discount / 100).toLocaleString("pt-BR")}%. Você pode editar.`}
          >
            <input
              inputMode="decimal"
              value={cost}
              onChange={(e) => {
                setManual(true);
                setCost(e.target.value);
              }}
              required
              placeholder="0,00"
            />
          </Field>
          <Field label="Preço de venda (R$)">
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => {
                setPriceManual(true);
                setPrice(e.target.value);
              }}
              required
              placeholder="0,00"
            />
          </Field>
        </div>
        {margin && (
          <p className="success-box">
            Lucro por unidade: <strong>{margin}</strong>
          </p>
        )}
      </AsyncForm>
    </Modal>
  );
}
export function ArchiveForm({
  kind,
  row,
  onDone,
  onClose,
}: {
  kind: "clients" | "products";
  row: Client | Product;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Arquivar ${row.name}?`}
      description="O histórico de vendas será preservado. O cadastro deixará de aparecer em novas vendas."
      onClose={onClose}
    >
      <AsyncForm
        submit="Arquivar"
        onSubmit={async () => {
          await api(`/${kind}/${row.id}`, "DELETE");
          await onDone();
        }}
      >
        <p>Você pode exportar os dados completos nas configurações.</p>
      </AsyncForm>
    </Modal>
  );
}
