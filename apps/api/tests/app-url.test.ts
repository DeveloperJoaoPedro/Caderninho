import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "../src/lib/app-url.js";

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
});
