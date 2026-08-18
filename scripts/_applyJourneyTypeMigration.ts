// Aplica prisma/migrations/20260818120000_journey_type/migration.sql.
// Usa el cliente generado directamente: src/lib/prisma arrastra `server-only`,
// que revienta fuera de un componente de servidor.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
(async () => {
  const sql = readFileSync("prisma/migrations/20260818120000_journey_type/migration.sql", "utf8");
  // Las líneas de comentario se quitan ANTES de partir: si no, el bloque de
  // cabecera queda pegado a la primera sentencia y el filtro `startsWith("--")`
  // descarta las dos juntas, saltándose el ALTER sin decir nada.
  const limpio = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const stmt of limpio.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
    console.log("→", stmt.slice(0, 80).replace(/\n/g, " "));
    try { const r = await prisma.$executeRawUnsafe(stmt); console.log("  OK rows=" + r); }
    catch (e) { console.error("  FAIL:", e instanceof Error ? e.message.slice(0, 200) : String(e)); }
  }
})().finally(() => prisma.$disconnect());
