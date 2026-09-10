// Solo lectura: datos de usuario y bundles que cuelgan del nivel de los Traveler PT-BR.
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const q = (s: string) => p.$queryRawUnsafe<any[]>(s);
const show = async (t: string, s: string) => { try { console.log(t, JSON.stringify(await q(s))); } catch (e: any) { console.log(t, "ERR", e.message.split("\n").pop()); } };
async function main() {
  await show("COLS:", `select table_name, string_agg(column_name, ',') c from information_schema.columns
    where table_name in ('dp_user_metrics_v1','Favorite','dp_favorites_v1','dp_continue_listening_v1','dp_story_ratings_v1','dp_story_practice_sets_v1','dp_tap_glosses_v1') group by 1`);
  await show("TABLAS fav:", `select table_name from information_schema.tables where table_name ilike '%favorit%'`);
  await show("METRIC evento/variant/level:", `select "eventType", metadata->>'variantId' v, metadata->>'levelId' l, count(*)::int n, count(distinct "userId")::int users
    from dp_user_metrics_v1 where metadata::text ilike '%brazil%' or "bookSlug" ilike '%brazil%' group by 1,2,3 order by 1,2,3`);
  await show("progressKey muestra:", `select distinct metadata->>'progressKey' pk, "bookSlug" from dp_user_metrics_v1 where metadata::text ilike '%brazil%' limit 8`);
  await show("usuarios distintos brazil:", `select count(distinct "userId")::int n from dp_user_metrics_v1 where metadata::text ilike '%brazil%' or "bookSlug" ilike '%brazil%'`);
  await show("TapGloss:", `select bundle, count(*)::int n from dp_tap_glosses_v1 where bundle ilike '%portuguese%' group by 1 order by 1`);
}
main().finally(() => p.$disconnect());
