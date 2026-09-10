// Solo lectura: cuanto se usan los enlaces pt-traveler-brazil-a0/-a1 (visitas, clics, correos).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const T = ["dp_page_visits_v1", "dp_outbound_clicks_v1", "dp_beta_email_log_v1", "dp_push_campaigns_v1", "dp_user_metrics_v1"];
async function main() {
  for (const t of T) for (const s of ["pt-traveler-brazil-a0", "pt-traveler-brazil-a1"]) {
    try {
      const r = await p.$queryRawUnsafe<any[]>(`select count(*)::int n, min("createdAt") desde, max("createdAt") hasta from ${t} x where row_to_json(x)::text ilike '%${s}%'`);
      console.log(t, s, JSON.stringify(r[0]));
    } catch (e: any) { console.log(t, s, "ERR", e.message.split("\n").pop()); }
  }
}
main().finally(() => p.$disconnect());
