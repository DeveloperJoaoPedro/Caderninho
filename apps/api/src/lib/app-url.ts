export function resolveAppUrl(env: NodeJS.ProcessEnv): string | undefined {
  // Cada Codespace tem uma origem própria; nunca aceitamos qualquer *.app.github.dev.
  if (
    env.NODE_ENV !== "production" &&
    env.NODE_ENV !== "test" &&
    env.CODESPACE_NAME &&
    env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ) {
    return `https://${env.CODESPACE_NAME}-5173.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }
  return env.APP_URL;
}

export function isAllowedOrigin(
  origin: string | undefined,
  fetchSite: string | undefined,
  appUrl: string,
  env: NodeJS.ProcessEnv,
): boolean {
  if (fetchSite === "cross-site") return false;
  if (!origin || origin === new URL(appUrl).origin) return true;
  // O túnel do Codespaces pode reescrever Origin para o endereço local.
  // A exceção exige o cabeçalho controlado pelo navegador e não vale em produção.
  return env.NODE_ENV !== "production" &&
    Boolean(env.CODESPACE_NAME && env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) &&
    fetchSite === "same-origin" &&
    ["http://localhost:5173", "https://localhost:5173"].includes(origin);
}
