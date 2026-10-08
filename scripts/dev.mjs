import { spawn } from "node:child_process";
if (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
  process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS =
    `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
}
const children = ["@caderninho/api", "@caderninho/web"].map((workspace) =>
  spawn("npm", ["run", "dev", "-w", workspace], {
    stdio: "inherit",
    detached: process.platform !== "win32",
  }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform !== "win32" && child.pid)
        process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 500).unref();
}
for (const child of children) child.on("exit", (code) => stop(code ?? 1));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
