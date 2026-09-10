// Solo lectura: quien visita pt-traveler-brazil-a0 y si algun correo lo lleva.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const q = (s: string) => p.$queryRawUnsafe<any[]>(s);
async function main() {
  for (const s of ["pt-traveler-brazil-a0", "pt-traveler-brazil-a1"])
    console.log("correos", s, JSON.stringify((await q(`select count(*)::int n from dp_beta_email_log_v1 x where row_to_json(x)::text ilike '%${s}%'`))[0]));
  console.log("cols visitas:", (await q(`select string_agg(column_name, ',') c from information_schema.columns where table_name='dp_page_visits_v1'`))[0].c);
  const r = await q(`select row_to_json(x)->>'userId' u, row_to_json(x)->>'internal' i, count(*)::int n, max(row_to_json(x)->>'createdAt') ult
    from dp_page_visits_v1 x where row_to_json(x)::text ilike '%pt-traveler-brazil-a0%' group by 1,2 order by 3 desc`);
  for (const x of r) console.log("visitas a0", JSON.stringify({ ...x, u: x.u ? x.u.slice(0, 12) + "…" : null }));
}
main().finally(() => p.$disconnect());
