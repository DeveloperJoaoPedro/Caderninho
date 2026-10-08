import { useState } from "react";
import { ArrowRight, Check, ArrowLeft } from "@phosphor-icons/react";
import {
  brands,
  brandNames,
  registerSchema,
  loginSchema,
  forgotSchema,
  resetSchema,
} from "@caderninho/shared";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { Logo, Field, AsyncForm, Button } from "../components/ui";
export function Auth({
  onLogin,
  onPrivacy,
}: {
  onLogin: (user: User) => void;
  onPrivacy: () => void;
}) {
  const token = new URLSearchParams(location.search).get("reset");
  const [mode, setMode] = useState(token ? "reset" : "login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [selected, setSelected] = useState<string[]>(["NATURA"]),
    [message, setMessage] = useState("");
  async function submit() {
    if (mode === "forgot") {
      const input = forgotSchema.parse({ email });
      const result = await api<{ message: string }>(
        "/auth/forgot",
        "POST",
        input,
      );
      setMessage(result.message);
      return;
    }
    if (mode === "reset") {
      await api("/auth/reset", "POST", resetSchema.parse({ token, password }));
      history.replaceState(null, "", "/");
      setMode("login");
      setPassword("");
      setMessage("Senha alterada. Entre com sua nova senha.");
      return;
    }
    const input =
      mode === "register"
        ? registerSchema.parse({ name, email, password, brands: selected })
        : loginSchema.parse({ email, password });
    onLogin(await api<User>("/auth/" + mode, "POST", input));
  }
  function change(next: string) {
    setMode(next);
    setMessage("");
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Logo />
        <div className="story-copy">
          <p className="eyebrow">SEU NEGÓCIO, BEM CUIDADO</p>
          <h1>
            Menos contas
            <br />
            na cabeça.
            <br />
            <span>Mais tranquilidade.</span>
          </h1>
          <p>
            Suas vendas, clientes e recebimentos em um lugar só. Simples como o
            seu caderninho.
          </p>
          <ul>
            {[
              "Saiba quem falta pagar",
              "Veja quanto você ganhou",
              "Cuide das suas clientes",
            ].map((t) => (
              <li key={t}>
                <Check weight="bold" size={20} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="story-footer">Feito para quem empreende todos os dias.</p>
      </section>
      <section className="auth-form-area">
        <div className="mobile-logo">
          <Logo />
        </div>
        <div className="auth-form">
          <p className="eyebrow">BEM-VINDA AO CADERNINHO</p>
          <h2>
            {mode === "register"
              ? "Vamos começar?"
              : mode === "forgot"
                ? "Esqueceu sua senha?"
                : mode === "reset"
                  ? "Crie uma nova senha"
                  : "Que bom ter você aqui."}
          </h2>
          <p className="intro">
            {mode === "register"
              ? "Crie sua conta e organize suas primeiras vendas."
              : mode === "forgot"
                ? "Vamos enviar um link para o seu e-mail."
                : mode === "reset"
                  ? "Escolha uma senha com pelo menos 8 caracteres."
                  : "Entre para cuidar das suas vendas."}
          </p>
          {message && (
            <p className="success-box" role="status">
              {message}
            </p>
          )}
          <AsyncForm
            onSubmit={submit}
            submit={
              mode === "register"
                ? "Criar minha conta"
                : mode === "forgot"
                  ? "Enviar link"
                  : mode === "reset"
                    ? "Salvar nova senha"
                    : "Entrar"
            }
          >
            {mode === "register" && (
              <Field label="Seu nome">
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Como podemos chamar você?"
                />
              </Field>
            )}
            {mode !== "reset" && (
              <Field label="E-mail">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="voce@exemplo.com.br"
                />
              </Field>
            )}
            {mode !== "forgot" && (
              <Field
                label="Senha"
                hint={
                  mode === "register"
                    ? "Use pelo menos 8 caracteres."
                    : undefined
                }
              >
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "login" ? 1 : 8}
                  placeholder="Sua senha"
                />
              </Field>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="text-button forgot-link"
                onClick={() => change("forgot")}
              >
                Esqueci minha senha
              </button>
            )}
            {mode === "register" && (
              <div className="field">
                <span>Quais marcas você revende?</span>
                <div className="brand-checks">
                  {brands.map((b) => (
                    <label key={b}>
                      <input
                        type="checkbox"
                        checked={selected.includes(b)}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(b)
                              ? s.filter((x) => x !== b)
                              : [...s, b],
                          )
                        }
                      />
                      {brandNames[b]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </AsyncForm>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <button onClick={() => change("register")}>
                  Criar conta <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => change("login")}>
                <ArrowLeft size={18} />
                Voltar para entrar
              </Button>
            )}
          </div>
          <p className="privacy-note">
            Seus dados ficam protegidos na sua conta.
            <br />
            <button onClick={onPrivacy}>
              Leia nossa política de privacidade
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
