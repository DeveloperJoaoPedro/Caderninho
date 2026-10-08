import { app } from "./app.js";
import { config } from "./lib/config.js";
import { db } from "./lib/db.js";
const server = app.listen(config.PORT, "0.0.0.0", () =>
  console.log(`API Caderninho na porta ${config.PORT}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    }),
  );
