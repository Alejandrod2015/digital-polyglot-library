// Solo lectura: forma de las claves de progreso en las filas de los Traveler PT-BR.
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const IDS = ["cmsou2uk0000732mqa4oatcmn","cmsyrge55000732u9oiu8wue3"];
async function main() {
  const r = await p.$queryRawUnsafe<any[]>(`select m."eventType", s.level, m."bookSlug", m.metadata->>'source' src, m.metadata->>'variantId' v, m.metadata->>'levelId' l, m.metadata->>'topicId' t, m.metadata->>'progressKey' pk, count(*)::int n, count(distinct m."userId")::int users
    from dp_user_metrics_v1 m join dp_journey_stories_v1 s on s.slug = m."storySlug" and s."journeyId" in (${IDS.map(i=>`'${i}'`).join(",")})
    where m."eventType" in ('practice_session_completed','audio_complete') group by 1,2,3,4,5,6,7,8 order by 1,2 limit 40`);
  for (const x of r) console.log(JSON.stringify(x));
  const k = await p.$queryRawUnsafe<any[]>(`select distinct jsonb_object_keys(m.metadata::jsonb) k from dp_user_metrics_v1 m join dp_journey_stories_v1 s on s.slug = m."storySlug" and s."journeyId" in (${IDS.map(i=>`'${i}'`).join(",")}) where m."eventType"='practice_session_completed'`);
  console.log("keys:", k.map(x => x.k).join(","));
}
main().finally(() => p.$disconnect());
