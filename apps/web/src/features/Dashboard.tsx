import {
  ArrowUpRight,
  Wallet,
  TrendUp,
  Receipt,
  Users,
  Plus,
  ArrowRight,
  CalendarBlank,
} from "@phosphor-icons/react";
import { money, dateLabel } from "@caderninho/shared";
import type { Dashboard as DashboardData, User } from "../lib/types";
import { Button, Avatar, Status, Empty } from "../components/ui";
export function Dashboard({
  data,
  user,
  onNavigate,
  onSale,
  onReceive,
}: {
  data: DashboardData;
  user: User;
  onNavigate: (page: string) => void;
  onSale: () => void;
  onReceive: (id: string) => void;
}) {
  const first = user.name.split(" ")[0];
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU NEGÓCIO EM DIA</p>
          <h1>Olá, {first}.</h1>
          <p>Um olhar tranquilo sobre as suas vendas.</p>
        </div>
        <Button onClick={onSale}>
          <Plus weight="bold" size={20} />
          Nova venda
        </Button>
      </div>
      <div className="dashboard-top">
        <div className="balance-card">
          <div className="balance-header">
            <span>
              <Wallet size={22} weight="duotone" />
              Você tem a receber
            </span>
            <ArrowUpRight size={24} />
          </div>
          <strong>{money(data.openCents)}</strong>
          <p>
            {data.debtorCount
              ? `${data.debtorCount} ${data.debtorCount === 1 ? "cliente com saldo em aberto" : "clientes com saldo em aberto"}`
              : "Tudo em dia por aqui."}
          </p>
          <button onClick={() => onNavigate("receivables")}>
            Ver meu fiado <ArrowRight size={18} />
          </button>
        </div>
        <div className="month-overview">
          <div className="section-top">
            <h2>Como está o mês</h2>
            <span className="muted capitalize">{month}</span>
          </div>
          <div className="metric-grid">
            <Metric
              icon={<TrendUp size={22} />}
              label="Recebido"
              value={data.receivedCents}
            />
            <Metric
              icon={<Wallet size={22} />}
              label="Lucro das vendas"
              value={data.marginCents}
              positive
            />
            <Metric
              icon={<Receipt size={22} />}
              label="Gastos"
              value={data.expenseCents}
            />
            <Metric
              icon={<Users size={22} />}
              label="Vendas realizadas"
              text={String(data.salesCount)}
            />
          </div>
          <p className="profit-split">
            Do lucro: <strong>{money(data.receivedMarginCents)}</strong>{" "}
            recebido · <strong>{money(data.openMarginCents)}</strong> a receber
          </p>
          <p className="metric-note">
            Lucro das vendas = vendas após descontos menos custo dos produtos.
          </p>
        </div>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="section-top">
            <div>
              <h2>Próximos recebimentos</h2>
              <p>Quem você precisa acompanhar.</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("receivables")}
            >
              Ver todos <ArrowRight size={16} />
            </button>
          </div>
          {data.upcoming.length ? (
            <div className="row-list">
              {data.upcoming.map((p) => (
                <button
                  className="payment-row"
                  key={p.id}
                  onClick={() => onReceive(p.id)}
                >
                  <Avatar name={p.sale.client.name} />
                  <div className="row-main">
                    <strong>{p.sale.client.name}</strong>
                    <span>
                      Parcela {p.number} · {dateLabel(p.dueOn)}
                    </span>
                  </div>
                  <div className="row-end">
                    <strong>{money(p.remainingCents)}</strong>
                    <Status status={p.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Sem parcelas em aberto"
              description="As vendas no fiado e seus vencimentos aparecerão aqui."
            />
          )}
        </section>
        <aside className="day-card" aria-label="Lembretes do dia">
          <CalendarBlank size={30} weight="duotone" />
          <h2>Um passo de cada vez.</h2>
          <p>
            {data.todayCount
              ? `${data.todayCount} ${data.todayCount === 1 ? "parcela vence" : "parcelas vencem"} hoje. Um lembrete carinhoso pode ajudar.`
              : "Registre uma venda assim que ela acontecer. Seu caderninho faz as contas para você."}
          </p>
          {data.overdueCents > 0 && (
            <div className="overdue-note">
              {money(data.overdueCents)} em parcelas atrasadas
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() =>
              onNavigate(data.todayCount ? "receivables" : "clients")
            }
          >
            {data.todayCount ? "Acompanhar parcelas" : "Ver minhas clientes"}
            <ArrowRight size={18} />
          </Button>
          <div className="day-footer">
            Mais organização.
            <br />
            Mais tempo para você.
          </div>
        </aside>
      </div>
    </>
  );
}
function Metric({
  icon,
  label,
  value,
  text,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
  positive?: boolean;
}) {
  return (
    <div className="metric">
      <span>
        {icon}
        {label}
      </span>
      <strong className={positive ? "positive" : ""}>
        {text ?? money(value ?? 0)}
      </strong>
    </div>
  );
}
