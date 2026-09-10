// Solo lectura: filas de usuario que apuntan a las historias de los Traveler PT-BR.
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const IDS = ["cmsou2uk0000732mqa4oatcmn","cmsyrge55000732u9oiu8wue3","cmtrcpgso00073232h8vaf7na","cmtq5n9a50007j8812p9lzxjr"];
const show = async (t: string, s: string) => { try { console.log(t, JSON.stringify(await p.$queryRawUnsafe(s))); } catch (e: any) { console.log(t, "ERR", e.message.split("\n").pop()); } };
async function main() {
  const st = await p.journeyStory.findMany({ where: { journeyId: { in: IDS } }, select: { id: true, slug: true, level: true } });
  const slugs = st.map(s => s.slug).filter(Boolean).map(s => `'${s}'`).join(",");
  const ids = st.map(s => `'${s.id}'`).join(",");
  const jids = IDS.map(i => `'${i}'`).join(",");
  await show("muestra practice/checkpoint (cualquier idioma):", `select "eventType", metadata from dp_user_metrics_v1 where "eventType" in ('practice_session_completed','journey_topic_checkpoint_complete') and metadata->>'source'='journey' order by "createdAt" desc limit 2`);
  await show("METRIC por historia:", `select m."eventType", s.level, count(*)::int n, count(distinct m."userId")::int users from dp_user_metrics_v1 m
    join dp_journey_stories_v1 s on s.slug = m."storySlug" and s."journeyId" in (${jids}) group by 1,2 order by 2,1`);
  await show("METRIC journey-level (practice/checkpoint) PT:", `select "eventType", metadata->>'variantId' v, metadata->>'levelId' l, count(*)::int n, count(distinct "userId")::int users
    from dp_user_metrics_v1 where "eventType" ilike '%checkpoint%' or "eventType"='practice_session_completed' group by 1,2,3 having metadata->>'variantId' ilike '%pt%' or metadata->>'variantId' ilike '%portug%' or metadata->>'variantId' ilike '%bra%'`);
  await show("METRIC con journeyId/storyId en metadata:", `select "eventType", count(*)::int n, count(distinct "userId")::int users from dp_user_metrics_v1 where metadata->>'journeyId' in (${jids}) or metadata->>'storyId' in (${ids}) group by 1`);
  await show("usuarios distintos (cualquier fila por slug):", `select count(distinct "userId")::int n from dp_user_metrics_v1 where "storySlug" in (${slugs})`);
  await show("Favorite:", `select count(*)::int n, count(distinct "userId")::int users from "Favorite" where "storySlug" in (${slugs})`);
  await show("continue_listening:", `select "bookSlug", count(*)::int n, count(distinct "userId")::int users from dp_continue_listening_v1 where "storySlug" in (${slugs}) group by 1`);
  await show("ratings:", `select count(*)::int n from dp_story_ratings_v1 where "storySlug" in (${slugs}) or "storyId" in (${ids})`);
  await show("practice sets:", `select count(*)::int n from dp_story_practice_sets_v1 where "storyId" in (${ids})`);
}
main().finally(() => p.$disconnect());
