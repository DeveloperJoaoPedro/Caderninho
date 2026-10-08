import { useEffect, useState } from "react";
import {
  House,
  ShoppingBag,
  Wallet,
  Users,
  Package,
  Receipt,
  CalendarBlank,
  ChartBar,
  GearSix,
  SignOut,
  DotsThree,
  ArrowRight,
  CheckCircle,
  SpinnerGap,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { api, ApiError } from "./lib/api";
import type {
  User,
  Data,
  Client,
  Product,
  Sale,
  Installment,
  Receipt as ReceiptData,
} from "./lib/types";
import { Logo, Avatar, Button, Modal, ErrorBox } from "./components/ui";
import { Auth } from "./features/Auth";
import { Dashboard } from "./features/Dashboard";
import {
  Clients,
  ClientForm,
  ClientHistory,
  Products,
  ProductForm,
  ArchiveForm,
} from "./features/CustomersProducts";
import {
  Sales,
  SaleForm,
  SaleDetail,
  Receivables,
  ReceiptForm,
  ChargeForm,
  ReasonForm,
} from "./features/Sales";
import {
  Expenses,
  ExpenseForm,
  Campaigns,
  CampaignForm,
} from "./features/ExpensesCampaigns";
import { Reports, Settings, Privacy } from "./features/ReportsSettings";
const navigation: { id: string; label: string; icon: Icon }[] = [
  { id: "home", label: "Início", icon: House },
  { id: "sales", label: "Vendas", icon: ShoppingBag },
  { id: "receivables", label: "Fiado", icon: Wallet },
  { id: "clients", label: "Clientes", icon: Users },
  { id: "products", label: "Produtos", icon: Package },
  { id: "expenses", label: "Gastos", icon: Receipt },
  { id: "campaigns", label: "Ciclos", icon: CalendarBlank },
  { id: "reports", label: "Relatórios", icon: ChartBar },
  { id: "settings", label: "Minha conta", icon: GearSix },
];
type ModalState =
  | { type: "client"; row?: Client }
  | { type: "history"; row: Client }
  | { type: "product"; row?: Product }
  | { type: "sale" }
  | { type: "saleDetail"; row: Sale }
  | { type: "receipt" | "charge"; row: Installment }
  | { type: "reverse"; row: ReceiptData }
  | { type: "cancel"; row: Sale }
  | { type: "expense" | "campaign" | "more" | "privacy" }
  | { type: "archiveClient"; row: Client }
  | { type: "archiveProduct"; row: Product };
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [initializing, setInitializing] = useState(true),
    [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState(() =>
      navigation.some((n) => n.id === location.hash.slice(1))
        ? location.hash.slice(1)
        : "home",
    ),
    [modal, setModal] = useState<ModalState | null>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    api<User>("/auth/me")
      .then((u) => {
        if (active) setUser(u);
      })
      .catch((e) => {
        if (active && !(e instanceof ApiError && e.status === 401))
          setError(e.message);
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function reload() {
    setLoading(true);
    try {
      const [
        clients,
        products,
        sales,
        installments,
        expenses,
        campaigns,
        dashboard,
      ] = await Promise.all([
        api<Data["clients"]>("/clients"),
        api<Data["products"]>("/products"),
        api<Data["sales"]>("/sales"),
        api<Data["installments"]>("/installments"),
        api<Data["expenses"]>("/expenses"),
        api<Data["campaigns"]>("/campaigns"),
        api<Data["dashboard"]>("/dashboard"),
      ]);
      setData({
        clients,
        products,
        sales,
        installments,
        expenses,
        campaigns,
        dashboard,
      });
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setData(null);
      } else
        setError(
          e instanceof Error
            ? e.message
            : "Não conseguimos carregar seus dados.",
        );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) void reload();
    else setData(null);
  }, [user?.id]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const handle = () => {
      const p = location.hash.slice(1);
      if (navigation.some((n) => n.id === p)) setPage(p);
    };
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);
  function navigate(p: string) {
    setPage(p);
    location.hash = p;
    setModal(null);
    window.scrollTo({ top: 0 });
  }
  async function done() {
    setModal(null);
    setToast("Pronto! Registro salvo.");
    await reload();
  }
  function receive(id: string) {
    const row = data?.installments.find((p) => p.id === id);
    if (row) setModal({ type: "receipt", row });
  }
  async function viewClient(row: Client) {
    try {
      setModal({
        type: "history",
        row: await api<Client>("/clients/" + row.id),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não conseguimos abrir o histórico.",
      );
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", "POST");
      setUser(null);
      setData(null);
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não conseguimos sair.");
    }
  }
  if (initializing)
    return (
      <div className="full-loading">
        <Logo />
        <SpinnerGap size={32} className="spin" />
        <p>Abrindo seu caderninho…</p>
      </div>
    );
  if (!user)
    return (
      <>
        <Auth
          onLogin={(u) => {
            setUser(u);
            setError("");
            navigate("home");
          }}
          onPrivacy={() => setModal({ type: "privacy" })}
        />
        {error && (
          <div className="connection-error">
            <ErrorBox message={error} />
          </div>
        )}
        {modal?.type === "privacy" && (
          <Privacy onClose={() => setModal(null)} />
        )}
      </>
    );
  const active = navigation.find((n) => n.id === page)!;
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Conta e navegação">
        <Logo />
        <p className="sidebar-caption">SEU NEGÓCIO, EM ORDEM</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: NavIcon }, i) => (
            <button
              key={id}
              aria-label={label}
              className={`${page === id ? "active" : ""} ${i === 7 ? "nav-divider" : ""}`}
              onClick={() => navigate(id)}
              aria-current={page === id ? "page" : undefined}
            >
              <NavIcon size={22} weight={page === id ? "fill" : "regular"} />
              {label}
              {id === "receivables" && !!data?.dashboard.todayCount && (
                <span className="nav-count">{data.dashboard.todayCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>Pequenos registros.</span>
            <strong>Grandes conquistas.</strong>
          </div>
          <button
            className="profile-button"
            onClick={() => navigate("settings")}
          >
            <Avatar name={user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>Meu caderninho</small>
            </span>
            <GearSix size={20} />
          </button>
          <button className="logout" onClick={() => void logout()}>
            <SignOut size={20} />
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="desktop-breadcrumb">
            Meu caderninho <span>/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="mobile-logo">
            <Logo />
          </div>
          <span className="topbar-date">
            {new Intl.DateTimeFormat("pt-BR", {
              day: "numeric",
              month: "long",
              timeZone: "America/Sao_Paulo",
            }).format(new Date())}
          </span>
          <button
            className="mobile-profile"
            aria-label="Minha conta"
            onClick={() => navigate("settings")}
          >
            <Avatar name={user.name} />
          </button>
        </header>
        <main className="main-content">
          <ErrorBox message={error} />
          {error && (
            <Button
              variant="secondary"
              onClick={() => void reload()}
              disabled={loading}
            >
              Tentar novamente
            </Button>
          )}
          {!data ? (
            <div className="data-loading">
              <SpinnerGap size={30} className="spin" />
              <p>
                {loading
                  ? "Carregando suas informações…"
                  : "Suas informações ainda não foram carregadas."}
              </p>
            </div>
          ) : (
            <>
              {page === "home" && (
                <Dashboard
                  data={data.dashboard}
                  user={user}
                  onNavigate={navigate}
                  onSale={() => setModal({ type: "sale" })}
                  onReceive={receive}
                />
              )}
              {page === "clients" && (
                <Clients
                  rows={data.clients}
                  onNew={() => setModal({ type: "client" })}
                  onEdit={(row) => setModal({ type: "client", row })}
                  onView={(row) => void viewClient(row)}
                />
              )}
              {page === "products" && (
                <Products
                  rows={data.products}
                  onNew={() => setModal({ type: "product" })}
                  onEdit={(row) => setModal({ type: "product", row })}
                />
              )}
              {page === "sales" && (
                <Sales
                  rows={data.sales}
                  onNew={() => setModal({ type: "sale" })}
                  onView={(row) => setModal({ type: "saleDetail", row })}
                />
              )}
              {page === "receivables" && (
                <Receivables
                  rows={data.installments}
                  clients={data.clients}
                  onReceive={(row) => setModal({ type: "receipt", row })}
                  onCharge={(row) => setModal({ type: "charge", row })}
                />
              )}
              {page === "expenses" && (
                <Expenses
                  rows={data.expenses}
                  onNew={() => setModal({ type: "expense" })}
                />
              )}
              {page === "campaigns" && (
                <Campaigns
                  rows={data.campaigns}
                  onNew={() => setModal({ type: "campaign" })}
                />
              )}
              {page === "reports" && <Reports />}
              {page === "settings" && (
                <Settings
                  user={user}
                  onUpdate={setUser}
                  onDelete={() => {
                    setUser(null);
                    setData(null);
                    setModal(null);
                  }}
                  onPrivacy={() => setModal({ type: "privacy" })}
                />
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Caderninho</span>Feito para simplificar o seu dia.
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navegação no celular">
        {navigation.slice(0, 3).map(({ id, label, icon: NavIcon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
          >
            <NavIcon size={24} weight={page === id ? "fill" : "regular"} />
            {label}
          </button>
        ))}
        <button
          onClick={() => setModal({ type: "more" })}
          className={
            !["home", "sales", "receivables"].includes(page) ? "active" : ""
          }
        >
          <DotsThree size={25} weight="bold" />
          Mais
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={22} weight="fill" />
          {toast}
        </div>
      )}
      {modal?.type === "privacy" && <Privacy onClose={() => setModal(null)} />}
      {modal?.type === "more" && (
        <Modal
          title="Meu caderninho"
          description="Tudo o que você precisa para cuidar do negócio."
          onClose={() => setModal(null)}
        >
          <div className="more-menu">
            {navigation.slice(3).map(({ id, label, icon: NavIcon }) => (
              <button onClick={() => navigate(id)} key={id}>
                <NavIcon size={24} />
                {label}
                <ArrowRight size={20} />
              </button>
            ))}
            <button onClick={() => void logout()}>
              <SignOut size={24} />
              Sair da conta
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "client" && (
        <ClientForm
          row={modal.row}
          onArchive={() => {
            if (modal.row) setModal({ type: "archiveClient", row: modal.row });
          }}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "archiveClient" && (
        <ArchiveForm
          kind="clients"
          row={modal.row}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "archiveProduct" && (
        <ArchiveForm
          kind="products"
          row={modal.row}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "history" && (
        <ClientHistory client={modal.row} onClose={() => setModal(null)} />
      )}
      {modal?.type === "product" && (
        <ProductForm
          row={modal.row}
          user={user}
          onArchive={() => {
            if (modal.row) setModal({ type: "archiveProduct", row: modal.row });
          }}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "sale" && data && (
        <SaleForm
          clients={data.clients}
          products={data.products}
          campaigns={data.campaigns}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "saleDetail" && (
        <SaleDetail
          row={modal.row}
          onClose={() => setModal(null)}
          onCancel={() => setModal({ type: "cancel", row: modal.row })}
          onReceipt={receive}
        />
      )}
      {modal?.type === "receipt" && (
        <ReceiptForm
          row={modal.row}
          onDone={done}
          onClose={() => setModal(null)}
          onReverse={(row) => setModal({ type: "reverse", row })}
        />
      )}
      {modal?.type === "charge" && (
        <ChargeForm row={modal.row} onClose={() => setModal(null)} />
      )}
      {modal?.type === "reverse" && (
        <ReasonForm
          kind="reverse"
          receipt={modal.row}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "cancel" && (
        <ReasonForm
          kind="cancel"
          sale={modal.row}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "expense" && data && (
        <ExpenseForm
          campaigns={data.campaigns}
          onDone={done}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "campaign" && (
        <CampaignForm onDone={done} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
