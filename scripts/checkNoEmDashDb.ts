/**
 * LINT (base de datos): busca los guiones largos, em (U+2014) y en (U+2013),
 * en TODA columna de texto, text / varchar / json / jsonb, del esquema public.
 *
 * El hermano de `checkNoEmDash.ts`, que solo mira archivos. Este existe porque
 * el 2026-08-16 seis etiquetas de nivel del tipo "A1 / Principiante" vivían en la BD,
 * fuera del alcance de cualquier lint de repositorio.
 *
 * Run:  npm run lint:no-emdash:db
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const db = new PrismaClient();

type Col = { table_name: string; column_name: string; data_type: string };

async function main() {
  const cols = await db.$queryRawUnsafe<Col[]>(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text','character varying','jsonb','json')
    ORDER BY table_name, column_name
  `);

  const out: string[] = [];
  for (const c of cols) {
    const expr = `"${c.column_name}"::text`;
    for (const d of [
      { char: "\u2014", name: "em" },
      { char: "\u2013", name: "en" },
    ]) {
      const sql = `SELECT count(*)::int AS n FROM "${c.table_name}" WHERE ${expr} LIKE '%${d.char}%'`;
      try {
        const r = await db.$queryRawUnsafe<{ n: number }[]>(sql);
        const n = r[0]?.n ?? 0;
        if (n > 0) out.push(`${c.table_name}.${c.column_name}\t${d.name}\t${n}`);
      } catch {
        /* skip weird columns */
      }
    }
  }
  console.log(out.join("\n"));
  console.log(`\nCOLUMNAS CON GUION LARGO: ${out.length}`);
  await db.$disconnect();
}
main();
