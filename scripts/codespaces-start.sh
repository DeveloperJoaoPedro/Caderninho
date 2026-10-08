#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# A API valida a origem. No Codespaces ela deve corresponder à porta encaminhada.
if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
  export APP_URL="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
fi
docker compose up -d --wait
npm run db:migrate
ready() {
  curl --fail --silent http://127.0.0.1:3001/api/health >/dev/null &&
    curl --fail --silent http://127.0.0.1:5173/ >/dev/null
}
if [[ "${1:-}" != "--restart" ]] && ready; then
  echo "Caderninho já está rodando. Abra a porta 5173 na aba Ports."
  exit 0
fi
pid_file=/tmp/caderninho-codespaces.pid
if [[ -f "$pid_file" ]]; then
  read -r saved_pid < "$pid_file"
  if [[ "$saved_pid" =~ ^[0-9]+$ ]] && kill -0 "$saved_pid" 2>/dev/null &&
    [[ "$(readlink "/proc/$saved_pid/cwd" 2>/dev/null || true)" == "$PWD" ]] &&
    [[ "$(ps -p "$saved_pid" -o args=)" == *"node scripts/dev.mjs"* ]]; then
    kill -TERM "$saved_pid"
    for ((attempt=0; attempt<20; attempt++)); do
      if ! kill -0 "$saved_pid" 2>/dev/null; then break; fi
      sleep 0.25
    done
  fi
fi
nohup node scripts/dev.mjs >/tmp/caderninho-dev.log 2>&1 &
printf '%s\n' "$!" > "$pid_file"
for ((attempt=0; attempt<30; attempt++)); do
  if ready; then
    echo "Caderninho pronto. Abra a porta 5173 na aba Ports."
    exit 0
  fi
  sleep 1
done
echo "Não foi possível iniciar. Consulte /tmp/caderninho-dev.log." >&2
exit 1
