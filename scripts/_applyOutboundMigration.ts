// Aplica prisma/migrations/20260823170000_outbound_clicks a mano.
//
// `prisma migrate deploy` no sirve aqui: el historial local y la tabla
// _prisma_migrations de la base llevan tiempo desincronizados (ocho
// migraciones figuran como pendientes aunque sus columnas ya existen), asi
// que un deploy intentaria reaplicarlas. Esta migracion es CREATE TABLE IF
// NOT EXISTS mas sus indices: aditiva, idempotente y sin tocar nada existente.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const DIR = "20260823170000_outbound_clicks";

async function main() {
  const sql = fs.readFileSync(path.join(process.cwd(), "prisma/migrations", DIR, "migration.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

  for (const stmt of statements) {
    if (!/^CREATE (TABLE|INDEX)/i.test(stmt)) {
      throw new Error(`sentencia no permitida en este script: ${stmt.slice(0, 60)}`);
    }
    await prisma.$executeRawUnsafe(stmt);
    console.log("  ok:", stmt.split("\n")[0].slice(0, 72));
  }

  const n = await prisma.outboundClick.count();
  console.log(`tabla lista, ${n} filas`);
}
main().finally(() => process.exit(0));
