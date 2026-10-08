import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  writeFileSync(
    ".env",
    readFileSync(".env.example", "utf8").replace(
      "troque_por_uma_chave_aleatoria_de_pelo_menos_32_caracteres",
      randomBytes(48).toString("hex"),
    ),
    { mode: 0o600 },
  );
  console.log(".env local criado com uma chave de sessão aleatória.");
} else console.log(".env existente preservado.");
