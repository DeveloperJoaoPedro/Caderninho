import { useState } from "react";
import {
  Plus,
  Trash,
  ArrowLeft,
  ArrowRight,
  WhatsappLogo,
} from "@phosphor-icons/react";
import {
  saleSchema,
  receiptSchema,
  cancelSchema,
  reversalSchema,
  money,
  dateLabel,
  today,
  monthlyDates,
  splitCents,
  parseMoney,
  paymentNames,
  brandNames,
} from "@caderninho/shared";
import { api } from "../lib/api";
import type {
  Client,
  Product,
  Campaign,
  Sale,
  Installment,
  Receipt,
} from "../lib/types";
import {
  AddButton,
  Empty,
  Modal,
  Field,
  AsyncForm,
  Button,
  Status,
  Avatar,
  ErrorBox,
} from "../components/ui";
export function Sales({
  rows,
  onNew,
  onView,
}: {
  rows: Sale[];
  onNew: () => void;
  onView: (row: Sale) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Minhas vendas</h1>
          <p>Cada venda registrada é uma conta a menos para lembrar.</p>
        </div>
        <AddButton onClick={onNew}>Nova venda</AddButton>
      </div>
      {rows.length ? (
        <div className="panel row-list">
          {rows.map((s) => (
            <button className="sale-row" key={s.id} onClick={() => onView(s)}>
              <Avatar name={s.client.name} />
              <div className="row-main">
                <strong>{s.client.name}</strong>
                <span>
                  {dateLabel(s.soldOn)} ·{" "}
                  {s.items.reduce((n, i) => n + i.quantity, 0)} produtos
                </span>
              </div>
              <div className="row-end">
                <strong>{money(s.totalCents)}</strong>
                <span>
                  {s.status === "CANCELLED"
                    ? "Cancelada"
                    : paymentNames[s.paymentMethod]}
                </span>
              </div>
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Sua próxima venda começa aqui"
          description="Escolha a cliente, os produtos e como ela vai pagar."
          action={<AddButton onClick={onNew}>Registrar venda</AddButton>}
        />
      )}
    </>
  );
}
export function SaleForm({
  clients,
  products,
  campaigns,
  onDone,
  onClose,
}: {
  clients: Client[];
  products: Product[];
  campaigns: Campaign[];
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    [clientId, setClientId] = useState(""),
    [items, setItems] = useState<
      { productId: string; quantity: number; campaignId: string | null }[]
    >([]),
    [productId, setProductId] = useState(""),
    [method, setMethod] = useState("PIX"),
    [soldOn, setSoldOn] = useState(today()),
    [discount, setDiscount] = useState("0,00"),
    [count, setCount] = useState(1),
    [firstDue, setFirstDue] = useState(today()),
    [customDates, setCustomDates] = useState<string[] | null>(null),
    [notes, setNotes] = useState(""),
    [error, setError] = useState("");
  const subtotal = items.reduce(
    (n, i) =>
      n +
      (products.find((p) => p.id === i.productId)?.priceCents ?? 0) *
        i.quantity,
    0,
  );
  let discountCents = 0;
  try {
    discountCents = parseMoney(discount);
  } catch {}
  const total = subtotal - discountCents;
  const dueDates =
    method === "CREDIT"
      ? (customDates ?? monthlyDates(firstDue, count))
      : [soldOn];
  let amounts: number[] = [];
  try {
    amounts = splitCents(total, dueDates.length);
  } catch {}
  function next() {
    setError("");
    if (step === 0 && !clientId) {
      setError("Escolha uma cliente.");
      return;
    }
    if (step === 1 && !items.length) {
      setError("Adicione pelo menos um produto.");
      return;
    }
    setStep((s) => s + 1);
  }
  return (
    <Modal
      title="Nova venda"
      description={`Passo ${step + 1} de 3 · ${["Escolha a cliente", "Escolha os produtos", "Combine o pagamento"][step]}`}
      onClose={onClose}
    >
      <div className="steps" aria-label={`Passo ${step + 1} de 3`}>
        {["Cliente", "Produtos", "Pagamento"].map((s, i) => (
          <span className={i <= step ? "active" : ""} key={s}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <AsyncForm
        submit={step < 2 ? "Continuar" : "Registrar venda"}
        onSubmit={async () => {
          if (step < 2) {
            next();
            return;
          }
          await api(
            "/sales",
            "POST",
            saleSchema.parse({
              clientId,
              soldOn,
              paymentMethod: method,
              discountCents: parseMoney(discount),
              items,
              dueDates,
              notes,
            }),
          );
          await onDone();
        }}
        secondary={
          step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft size={18} />
              Voltar
            </Button>
          )
        }
      >
        {step === 0 && (
          <>
            <Field label="Para quem é a venda?">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              >
                <option value="">Escolha uma cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {!clients.length && (
              <p className="note">
                Cadastre uma cliente em “Clientes” antes de registrar a venda.
              </p>
            )}
            <Field label="Data da venda">
              <input
                type="date"
                value={soldOn}
                max={today()}
                onChange={(e) => setSoldOn(e.target.value)}
                required
              />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Adicionar produto">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Escolha um produto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {money(p.priceCents)}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={!productId}
              onClick={() => {
                setItems((s) => [
                  ...s,
                  { productId, quantity: 1, campaignId: null },
                ]);
                setProductId("");
              }}
            >
              <Plus size={18} />
              Adicionar à venda
            </Button>
            {!products.length && (
              <p className="note">
                Cadastre um produto em “Produtos” antes de registrar a venda.
              </p>
            )}
            {items.map((item, index) => {
              const p = products.find((p) => p.id === item.productId)!;
              return (
                <div className="sale-item" key={index}>
                  <div className="section-top">
                    <strong>{p.name}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remover ${p.name}`}
                      onClick={() =>
                        setItems((s) => s.filter((_, i) => i !== index))
                      }
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                  <div className="two-fields">
                    <Field label="Quantidade">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={item.quantity}
                        onChange={(e) =>
                          setItems((s) =>
                            s.map((v, i) =>
                              i === index
                                ? { ...v, quantity: Number(e.target.value) }
                                : v,
                            ),
                          )
                        }
                        required
                      />
                    </Field>
                    <Field label="Ciclo (opcional)">
                      <select
                        value={item.campaignId ?? ""}
                        onChange={(e) =>
                          setItems((s) =>
                            s.map((v, i) =>
                              i === index
                                ? { ...v, campaignId: e.target.value || null }
                                : v,
                            ),
                          )
                        }
                      >
                        <option value="">Sem ciclo</option>
                        {campaigns
                          .filter(
                            (c) =>
                              c.brand === p.brand &&
                              c.startsOn.slice(0, 10) <= soldOn &&
                              c.endsOn.slice(0, 10) >= soldOn,
                          )
                          .map((c) => (
                            <option value={c.id} key={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                  <p>
                    {item.quantity} × {money(p.priceCents)} ={" "}
                    <strong>{money(item.quantity * p.priceCents)}</strong>
                  </p>
                </div>
              );
            })}
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Como a cliente vai pagar?">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {Object.entries(paymentNames).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                    {value === "CREDIT" ? " · pagar depois" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Desconto na venda (R$)">
              <input
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                required
              />
            </Field>
            {method === "CREDIT" && (
              <>
                <div className="two-fields">
                  <Field label="Número de parcelas">
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={count}
                      onChange={(e) => {
                        setCount(
                          Math.max(1, Math.min(36, Number(e.target.value))),
                        );
                        setCustomDates(null);
                      }}
                      required
                    />
                  </Field>
                  <Field label="Primeiro vencimento">
                    <input
                      type="date"
                      value={firstDue}
                      min={soldOn}
                      onChange={(e) => {
                        setFirstDue(e.target.value);
                        setCustomDates(null);
                      }}
                      required
                    />
                  </Field>
                </div>
                <div className="installment-preview">
                  {dueDates.map((d, i) => (
                    <Field
                      key={i}
                      label={`Parcela ${i + 1} · ${money(amounts[i] ?? 0)}`}
                    >
                      <input
                        type="date"
                        value={d}
                        min={soldOn}
                        onChange={(e) =>
                          setCustomDates(
                            dueDates.map((v, j) =>
                              j === i ? e.target.value : v,
                            ),
                          )
                        }
                        required
                      />
                    </Field>
                  ))}
                </div>
              </>
            )}
            {method !== "CREDIT" && (
              <p className="success-box">
                O valor será registrado como recebido no dia da venda.
              </p>
            )}
            <Field label="Observações (opcional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
              />
            </Field>
          </>
        )}
        <ErrorBox message={error} />
        <div className="sale-total">
          <span>{step === 2 ? "Total com desconto" : "Total da venda"}</span>
          <strong>{money(step === 2 ? total : subtotal)}</strong>
        </div>
      </AsyncForm>
    </Modal>
  );
}
export function Receivables({
  rows,
  clients,
  onReceive,
  onCharge,
}: {
  rows: Installment[];
  clients: Client[];
  onReceive: (row: Installment) => void;
  onCharge: (row: Installment) => void;
}) {
  const [status, setStatus] = useState("OPEN"),
    [clientId, setClientId] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const filtered = rows.filter(
    (r) =>
      (status === "ALL" ||
        (status === "OPEN" &&
          r.remainingCents > 0 &&
          r.status !== "CANCELLED") ||
        r.status === status) &&
      (!clientId || r.sale.clientId === clientId) &&
      (!from || r.dueOn.slice(0, 10) >= from) &&
      (!to || r.dueOn.slice(0, 10) <= to),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meu fiado</h1>
          <p>Saiba quem falta pagar e acompanhe cada parcela.</p>
        </div>
      </div>
      <div className="filters">
        <Field label="Situação">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              ["OPEN", "Em aberto"],
              ["OVERDUE", "Atrasadas"],
              ["TODAY", "Vencem hoje"],
              ["PENDING", "A vencer"],
              ["PAID", "Pagas"],
              ["CANCELLED", "Canceladas"],
              ["ALL", "Todas"],
            ].map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cliente">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Todas as clientes</option>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="De">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      {filtered.length ? (
        <div className="receivable-list">
          {filtered.map((p) => (
            <article
              className={`receivable-card ${p.status.toLowerCase()}`}
              key={p.id}
            >
              <div className="section-top">
                <div className="inline-person">
                  <Avatar name={p.sale.client.name} />
                  <div>
                    <h2>{p.sale.client.name}</h2>
                    <p>
                      Parcela {p.number} · {dateLabel(p.dueOn)}
                    </p>
                  </div>
                </div>
                <Status status={p.status} />
              </div>
              <div className="receivable-amount">
                <span>
                  {p.status === "CANCELLED"
                    ? "Saldo da venda cancelada"
                    : p.status === "PAID"
                      ? "Valor pago"
                      : "Falta receber"}
                  <strong>
                    {money(
                      p.status === "PAID" ? p.amountCents : p.remainingCents,
                    )}
                  </strong>
                </span>
                {p.paidCents > 0 && p.remainingCents > 0 && (
                  <small>
                    Já recebeu {money(p.paidCents)} de {money(p.amountCents)}
                  </small>
                )}
              </div>
              <div className="actions">
                {p.status !== "PAID" && p.status !== "CANCELLED" && (
                  <>
                    <Button onClick={() => onReceive(p)}>
                      Registrar pagamento
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!p.sale.client.phone}
                      onClick={() => onCharge(p)}
                    >
                      <WhatsappLogo size={20} />
                      Cobrar
                    </Button>
                  </>
                )}
                {p.receipts.length > 0 && (
                  <button className="text-button" onClick={() => onReceive(p)}>
                    Ver pagamentos
                  </button>
                )}
                {!p.sale.client.phone && p.remainingCents > 0 && (
                  <small>Adicione um telefone à cliente para cobrar.</small>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Nenhuma parcela nesta seleção"
          description="As parcelas das vendas no fiado aparecerão aqui. Você também pode mudar os filtros."
        />
      )}
    </>
  );
}
export function ReceiptForm({
  row,
  onDone,
  onClose,
  onReverse,
}: {
  row: Installment;
  onDone: () => Promise<void>;
  onClose: () => void;
  onReverse: (receipt: Receipt) => void;
}) {
  const [amount, setAmount] = useState(
      (row.remainingCents / 100).toFixed(2).replace(".", ","),
    ),
    [paidOn, setPaidOn] = useState(today()),
    [method, setMethod] = useState("PIX");
  return (
    <Modal
      title={row.sale.client.name}
      description={`Parcela ${row.number} · ${dateLabel(row.dueOn)}`}
      onClose={onClose}
    >
      <div className="summary-pair">
        <span>
          Valor da parcela<strong>{money(row.amountCents)}</strong>
        </span>
        <span>
          Falta receber<strong>{money(row.remainingCents)}</strong>
        </span>
      </div>
      {row.remainingCents > 0 && row.status !== "CANCELLED" && (
        <AsyncForm
          submit="Confirmar pagamento"
          onSubmit={async () => {
            await api(
              `/installments/${row.id}/receipts`,
              "POST",
              receiptSchema.parse({
                amountCents: parseMoney(amount),
                paidOn,
                method,
              }),
            );
            await onDone();
          }}
        >
          <Field
            label="Quanto recebeu? (R$)"
            hint="Pode ser o total ou apenas uma parte."
          >
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <div className="two-fields">
            <Field label="Data do pagamento">
              <input
                type="date"
                value={paidOn}
                max={today()}
                min={row.sale.soldOn.slice(0, 10)}
                onChange={(e) => setPaidOn(e.target.value)}
                required
              />
            </Field>
            <Field label="Recebeu como?">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {Object.entries(paymentNames)
                  .filter(([k]) => k !== "CREDIT")
                  .map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </AsyncForm>
      )}
      {row.receipts.length > 0 && (
        <section className="receipt-history">
          <h3>Histórico de pagamentos</h3>
          {row.receipts.map((r) => (
            <div className="history-row" key={r.id}>
              <div>
                <strong>
                  {money(r.amountCents)} · {paymentNames[r.method]}
                </strong>
                <p>
                  {dateLabel(r.paidOn)}
                  {r.reversal &&
                    ` · Estornado em ${dateLabel(r.reversal.reversedOn)}`}
                </p>
                {r.reversal && <small>{r.reversal.reason}</small>}
              </div>
              {!r.reversal && (
                <button
                  className="text-button danger-text"
                  onClick={() => onReverse(r)}
                >
                  Estornar
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </Modal>
  );
}
export function ChargeForm({
  row,
  onClose,
}: {
  row: Installment;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(
    `Olá, ${row.sale.client.name}! Tudo bem? Passando para lembrar da parcela de ${money(row.remainingCents)}, com vencimento em ${dateLabel(row.dueOn)}. Quando puder, me avise sobre o pagamento. Obrigada!`,
  );
  return (
    <Modal
      title="Lembrete pelo WhatsApp"
      description="Edite a mensagem antes de enviar. O WhatsApp abrirá com o texto pronto."
      onClose={onClose}
    >
      <Field label="Mensagem">
        <textarea
          className="charge-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
        />
      </Field>
      <a
        className="button"
        href={`https://wa.me/${row.sale.client.phone}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsappLogo size={22} />
        Abrir WhatsApp
      </a>
    </Modal>
  );
}
export function SaleDetail({
  row,
  onClose,
  onCancel,
  onReceipt,
}: {
  row: Sale;
  onClose: () => void;
  onCancel: () => void;
  onReceipt: (id: string) => void;
}) {
  return (
    <Modal
      title={`Venda para ${row.client.name}`}
      description={`${dateLabel(row.soldOn)} · ${paymentNames[row.paymentMethod]}`}
      onClose={onClose}
    >
      {row.status === "CANCELLED" && (
        <p className="note">
          Esta venda foi cancelada. O histórico foi preservado.
        </p>
      )}
      <div className="row-list">
        {row.items.map((i) => (
          <div className="history-row" key={i.id}>
            <span>
              {i.quantity}× {i.productName}
            </span>
            <strong>{money(i.priceCents * i.quantity)}</strong>
          </div>
        ))}
      </div>
      <div className="sale-total">
        <span>Desconto: {money(row.discountCents)}</span>
        <strong>{money(row.totalCents)}</strong>
      </div>
      <h3>Parcelas e pagamentos</h3>
      {row.installments.map((p) => (
        <button
          className="history-row full-width"
          key={p.id}
          onClick={() => onReceipt(p.id)}
        >
          <span>
            Parcela {p.number} · {dateLabel(p.dueOn)}
          </span>
          <strong>
            {money(p.amountCents)} <ArrowRight size={16} />
          </strong>
        </button>
      ))}
      {row.status === "ACTIVE" && (
        <Button variant="ghost danger-text" onClick={onCancel}>
          Cancelar venda
        </Button>
      )}
    </Modal>
  );
}
export function ReasonForm({
  kind,
  receipt,
  sale,
  onDone,
  onClose,
}: {
  kind: "reverse" | "cancel";
  receipt?: Receipt;
  sale?: Sale;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [reversedOn, setReversedOn] = useState(today());
  return (
    <Modal
      title={kind === "reverse" ? "Estornar recebimento" : "Cancelar venda"}
      description={
        kind === "reverse"
          ? "O pagamento e o motivo do estorno ficam no histórico. O saldo será reaberto."
          : "O histórico será preservado. Estorne os pagamentos antes de cancelar."
      }
      onClose={onClose}
    >
      <AsyncForm
        submit={
          kind === "reverse" ? "Confirmar estorno" : "Confirmar cancelamento"
        }
        onSubmit={async () => {
          if (kind === "reverse")
            await api(
              `/receipts/${receipt!.id}/reverse`,
              "POST",
              reversalSchema.parse({ reason, reversedOn }),
            );
          else
            await api(
              `/sales/${sale!.id}/cancel`,
              "POST",
              cancelSchema.parse({ reason }),
            );
          await onDone();
        }}
      >
        <Field label="Motivo">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={500}
          />
        </Field>
        {kind === "reverse" && (
          <Field label="Data do estorno">
            <input
              type="date"
              value={reversedOn}
              min={receipt?.paidOn.slice(0, 10)}
              max={today()}
              onChange={(e) => setReversedOn(e.target.value)}
              required
            />
          </Field>
        )}
      </AsyncForm>
    </Modal>
  );
}
