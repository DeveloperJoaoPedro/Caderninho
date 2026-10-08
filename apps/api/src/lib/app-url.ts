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
