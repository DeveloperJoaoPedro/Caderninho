import { useState, useEffect } from "react";
import { DownloadSimple, Trash, CheckCircle } from "@phosphor-icons/react";
import { z } from "zod";
import {
  brands,
  brandNames,
  profileSchema,
  brandSettingSchema,
  periodSchema,
  today,
  money,
} from "@caderninho/shared";
import { api, download } from "../lib/api";
import type { User, Report } from "../lib/types";
import {
  Button,
  Field,
  AsyncForm,
  Modal,
  ErrorBox,
  Empty,
} from "../components/ui";
export function Reports() {
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today()),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const p = periodSchema.parse({ from, to });
      setReport(await api<Report>(`/reports?from=${p.from}&to=${p.to}`));
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? e.issues[0].message
          : e instanceof Error
            ? e.message
            : "Confira o período.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function exportFile(format: "csv" | "pdf") {
    setError("");
    try {
      const p = periodSchema.parse({ from: report!.from, to: report!.to });
      await download(
        `/reports/export?from=${p.from}&to=${p.to}&format=${format}`,
        `caderninho-relatorio.${format}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não conseguimos exportar.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Meus resultados</h1>
          <p>Entenda o que suas vendas estão trazendo para você.</p>
        </div>
      </div>
      <form
        className="filters report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Field label="De">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            required
          />
        </Field>
        <Button disabled={busy}>
          {busy ? "Calculando…" : "Ver resultado"}
        </Button>
      </form>
      <ErrorBox message={error} />
      {report && (
        <>
          <div className="report-metrics">
            <div>
              <span>Vendas</span>
              <strong>{money(report.salesCents)}</strong>
            </div>
            <div>
              <span>Lucro das vendas</span>
              <strong>{money(report.marginCents)}</strong>
            </div>
            <div>
              <span>Despesas operacionais</span>
              <strong>{money(report.operatingCents)}</strong>
            </div>
            <div>
              <span>Lucro líquido</span>
              <strong>{money(report.profitCents)}</strong>
            </div>
          </div>
          <p className="note">
            Lucro líquido = vendas após descontos − custo dos produtos vendidos
            − despesas operacionais. Pedidos à marca entram no caixa, sem
            descontar o custo duas vezes.
          </p>
          <div className="summary-pair panel">
            <span>
              Recebido no período (com estornos)
              <strong>{money(report.receivedCents)}</strong>
            </span>
            <span>
              Gastos no período<strong>{money(report.expenseCents)}</strong>
            </span>
          </div>
          <div className="actions export-actions">
            <Button variant="secondary" onClick={() => void exportFile("pdf")}>
              <DownloadSimple size={20} />
              Baixar PDF
            </Button>
            <Button variant="secondary" onClick={() => void exportFile("csv")}>
              <DownloadSimple size={20} />
              Baixar CSV
            </Button>
          </div>
          {(["clients", "products"] as const).map((kind) => (
            <section className="panel report-panel" key={kind}>
              <h2>
                {kind === "clients"
                  ? "Margem por cliente"
                  : "Margem por produto"}
              </h2>
              <p>
                Vendas após descontos menos custo vendido, antes das despesas
                operacionais.
              </p>
              {report[kind].length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{kind === "clients" ? "Cliente" : "Produto"}</th>
                        <th>Vendas</th>
                        <th>Custo</th>
                        <th>Margem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report[kind].map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.name}
                            {r.quantity !== undefined && (
                              <small>{r.quantity} unidades</small>
                            )}
                          </td>
                          <td>{money(r.salesCents)}</td>
                          <td>{money(r.costCents)}</td>
                          <td>{money(r.marginCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Ainda sem vendas neste período"
                  description="Os resultados aparecerão depois de registrar uma venda."
                />
              )}
            </section>
          ))}
        </>
      )}
    </>
  );
}
export function Settings({
  user,
  onUpdate,
  onDelete,
  onPrivacy,
}: {
  user: User;
  onUpdate: (user: User) => void;
  onDelete: () => void;
  onPrivacy: () => void;
}) {
  const [name, setName] = useState(user.name),
    [selected, setSelected] = useState(user.brands),
    [saved, setSaved] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState("");
  const [discounts, setDiscounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      brands.map((b) => [
        b,
        String(
          (user.brandSettings.find((s) => s.brand === b)?.discountBps ?? 0) /
            100,
        ).replace(".", ","),
      ]),
    ),
  );
  async function backup() {
    try {
      setError("");
      await download("/backup", "caderninho-backup.json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não conseguimos exportar.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Minha conta</h1>
          <p>Seu perfil, suas marcas e seus dados.</p>
        </div>
      </div>
      {saved && (
        <p className="success-box" role="status">
          <CheckCircle size={20} />
          {saved}
        </p>
      )}
      <section className="panel settings-panel">
        <h2>Sobre você</h2>
        <AsyncForm
          onSubmit={async () => {
            const u = await api<User>(
              "/auth/me",
              "PATCH",
              profileSchema.parse({ name, brands: selected }),
            );
            onUpdate(u);
            setSaved("Perfil atualizado.");
          }}
        >
          <Field label="Seu nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="E-mail">
            <input value={user.email} disabled />
          </Field>
          <div className="field">
            <span>Marcas que você revende</span>
            <div className="brand-checks">
              {brands.map((b) => (
                <label key={b}>
                  <input
                    type="checkbox"
                    checked={selected.includes(b)}
                    onChange={() =>
                      setSelected((s) =>
                        s.includes(b) ? s.filter((x) => x !== b) : [...s, b],
                      )
                    }
                  />
                  {brandNames[b]}
                </label>
              ))}
            </div>
          </div>
        </AsyncForm>
      </section>
      <section className="panel settings-panel">
        <h2>Desconto padrão por marca</h2>
        <p>
          Usado para sugerir seu custo ao cadastrar um produto. Produtos já
          cadastrados não serão alterados.
        </p>
        {brands.map((brand) => (
          <div className="brand-setting" key={brand}>
            <AsyncForm
              submit="Salvar desconto"
              onSubmit={async () => {
                const raw = discounts[brand];
                if (!/^\d{1,3}(,\d{1,2})?$/.test(raw))
                  throw new Error("Use um percentual como 30 ou 30,50.");
                const [a, b = ""] = raw.split(",");
                const setting = brandSettingSchema.parse({
                  brand,
                  discountBps: Number(a) * 100 + Number(b.padEnd(2, "0")),
                });
                await api("/brand-settings", "PUT", setting);
                onUpdate(await api<User>("/auth/me"));
                setSaved(`Desconto de ${brandNames[brand]} atualizado.`);
              }}
            >
              <Field label={`${brandNames[brand]} · desconto (%)`}>
                <input
                  inputMode="decimal"
                  value={discounts[brand]}
                  onChange={(e) =>
                    setDiscounts((s) => ({ ...s, [brand]: e.target.value }))
                  }
                  required
                />
              </Field>
            </AsyncForm>
          </div>
        ))}
      </section>
      <section className="panel settings-panel">
        <h2>Seus dados pertencem a você</h2>
        <p>
          Exporte seus cadastros e histórico em um arquivo JSON. Guarde o
          arquivo em um lugar seguro.
        </p>
        <ErrorBox message={error} />
        <div className="actions">
          <Button variant="secondary" onClick={() => void backup()}>
            <DownloadSimple size={20} />
            Exportar meus dados
          </Button>
          <button className="text-button" onClick={onPrivacy}>
            Política de privacidade
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>Excluir minha conta</h2>
        <p>
          A exclusão remove seus dados deste aplicativo. Exporte uma cópia antes
          de continuar.
        </p>
        <Button variant="ghost danger-text" onClick={() => setDeleting(true)}>
          <Trash size={20} />
          Excluir minha conta
        </Button>
      </section>
      {deleting && (
        <Modal
          title="Excluir sua conta?"
          description="Esta ação é permanente. Todas as suas clientes, vendas e registros serão removidos."
          onClose={() => setDeleting(false)}
        >
          <AsyncForm
            submit="Excluir conta permanentemente"
            onSubmit={async () => {
              await api("/auth/me", "DELETE", { password });
              onDelete();
            }}
          >
            <Field label="Confirme sua senha">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
          </AsyncForm>
        </Modal>
      )}
    </>
  );
}
export function Privacy({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Política de privacidade"
      description="Como o Caderninho trata seus dados."
      onClose={onClose}
    >
      <div className="privacy-content">
        <p>
          O Caderninho armazena seu nome, e-mail, marcas e os registros de
          clientes, produtos, vendas e pagamentos que você informa. Esses dados
          são usados para organizar seu negócio e recuperar seu acesso.
        </p>
        <h3>Acesso e segurança</h3>
        <p>
          Seus registros são vinculados à sua conta. A senha é armazenada como
          hash bcrypt. O aplicativo usa um cookie de sessão e não utiliza
          rastreadores publicitários.
        </p>
        <h3>Clientes e WhatsApp</h3>
        <p>
          Cadastre apenas dados necessários ao relacionamento comercial e
          informe suas clientes sobre esse uso. Ao abrir uma cobrança, você
          compartilha o telefone e a mensagem com o WhatsApp, sujeito à política
          desse serviço.
        </p>
        <h3>Exportação e exclusão</h3>
        <p>
          Você pode exportar seus dados e excluir sua conta em “Minha conta”. Os
          dados permanecem no banco ativo enquanto sua conta existir. Cópias de
          segurança da operação precisam ter prazo de retenção definido pelo
          responsável pelo serviço.
        </p>
        <h3>Responsável pelo serviço</h3>
        <p>
          Antes de disponibilizar esta aplicação comercialmente, o operador
          deverá informar sua identificação, contato para solicitações LGPD,
          fornecedores de hospedagem e e-mail e prazo de retenção dos backups.
          Este texto é a política inicial do projeto em desenvolvimento.
        </p>
      </div>
    </Modal>
  );
}
