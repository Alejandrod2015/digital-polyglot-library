// Solo lectura: filas de checkpoint/practica cuyo variantId es el id de un Traveler PT-BR.
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const IDS = ["cmsou2uk0000732mqa4oatcmn","cmsyrge55000732u9oiu8wue3","cmtrcpgso00073232h8vaf7na","cmtq5n9a50007j8812p9lzxjr"].map(i=>`'${i}'`).join(",");
async function main() {
  console.log(JSON.stringify(await p.$queryRawUnsafe(`select "eventType", metadata->>'variantId' v, metadata->>'levelId' l, count(*)::int n, count(distinct "userId")::int users
    from dp_user_metrics_v1 where metadata->>'variantId' in (${IDS}) or "storySlug" like any(array['a0:%','a1:%']) and metadata->>'variantId' in (${IDS}) group by 1,2,3`)));
  console.log(JSON.stringify(await p.$queryRawUnsafe(`select count(*)::int n from dp_story_ratings_v1 where "storySlug" like 'topic:cmsou2uk%' or "storySlug" like 'topic:cmsyrge5%'`)));
  console.log(JSON.stringify(await p.$queryRawUnsafe(`select count(*)::int n from dp_story_practice_exercises_v1 e join dp_story_practice_sets_v1 s on s.id=e."setId" join dp_journey_stories_v1 j on j.id=s."storyId" where j."journeyId" in (${IDS}) and e.cefr is not null`)));
}
main().catch(e=>console.log(e.message.split("\n").pop())).finally(() => p.$disconnect());
