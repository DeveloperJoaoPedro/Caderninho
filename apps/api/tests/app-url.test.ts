import { describe, expect, it } from "vitest";
import { resolveAppUrl, isAllowedOrigin } from "../src/lib/app-url.js";

describe("Origem do Codespaces", () => {
  const env = {
    APP_URL: "http://localhost:5173",
    CODESPACE_NAME: "meu-caderninho",
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
  };
  it("usa somente o endereço do próprio Codespace em desenvolvimento", () => {
    expect(resolveAppUrl(env)).toBe("https://meu-caderninho-5173.app.github.dev");
  });
  it("preserva a configuração explícita em produção e nos testes", () => {
    for (const NODE_ENV of ["production", "test"])
      expect(resolveAppUrl({ ...env, NODE_ENV })).toBe(env.APP_URL);
  });
  it("preserva localhost fora de Codespaces", () => {
    expect(resolveAppUrl({ APP_URL: env.APP_URL })).toBe(env.APP_URL);
  });
  it("aceita a origem local reescrita pelo túnel apenas no Codespaces", () => {
    const url = resolveAppUrl(env)!;
    expect(isAllowedOrigin("https://localhost:5173", "same-origin", url, env)).toBe(true);
    expect(isAllowedOrigin("https://localhost:5173", "same-origin", url, {})).toBe(false);
    expect(isAllowedOrigin("https://localhost:5173", "same-origin", url, { ...env, NODE_ENV: "production" })).toBe(false);
  });
  it("bloqueia sites externos e a exceção sem confirmação de mesma origem", () => {
    const url = resolveAppUrl(env)!;
    for (const site of [undefined, "same-site", "cross-site"])
      expect(isAllowedOrigin("https://localhost:5173", site, url, env)).toBe(false);
    expect(isAllowedOrigin("https://outro.app.github.dev", "same-origin", url, env)).toBe(false);
    expect(isAllowedOrigin(url, "cross-site", url, env)).toBe(false);
    expect(isAllowedOrigin(url, "same-origin", url, env)).toBe(true);
  });
});
