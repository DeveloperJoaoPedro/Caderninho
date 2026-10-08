import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";
import { randomBytes } from "node:crypto";
dotenv.config({ path: ".env", quiet: true });
// Cada execução ganha um schema próprio, sem limpar dados do desenvolvimento.
const schema = "test_" + randomBytes(8).toString("hex");
const client = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});
await client.connect();
const url = new URL(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
url.searchParams.set("schema", schema);
let result = 1;
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  const testEnv = {
    ...process.env,
    DATABASE_URL: url.toString(),
    NODE_ENV: "test",
  };
  const migration = spawnSync("npm", ["run", "db:migrate"], {
    env: testEnv,
    stdio: "inherit",
  });
  if (migration.status !== 0)
    throw new Error("Não foi possível preparar o banco de testes.");
  result =
    spawnSync("npm", ["run", "test", "-w", "@caderninho/api"], {
      env: testEnv,
      stdio: "inherit",
    }).status ?? 1;
} finally {
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}
process.exit(result);
