import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma: any = new PrismaClient();

(async () => {
  const js: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, language, variant, "typeSlug", levels, status, "createdAt", "updatedAt"
    FROM "dp_journeys_v1" WHERE status = 'active' ORDER BY language, variant`);
  console.log("=== JOURNEYS ACTIVE ===");
  for (const j of js) console.log(j.id, j.language, j.variant, j.typeSlug, (j.levels||[]).join("/"), "created", j.createdAt?.toISOString?.().slice(0,10), "upd", j.updatedAt?.toISOString?.().slice(0,10));

  for (const j of js) {
    const c: any[] = await prisma.$queryRawUnsafe(`
      SELECT ex.type, ex.featured,
             count(*)::int total,
             count(*) FILTER (WHERE (ex.type='meaning_in_context' AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'')
                                 OR (ex.type='fill_blank' AND coalesce(ex.payload->'audioClip'->>'clipUrl','')<>''))::int ok
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
      WHERE st."journeyId"=$1 AND ex.type IN ('meaning_in_context','fill_blank')
      GROUP BY 1,2 ORDER BY 1,2`, j.id);
    if (!c.length) continue;
    const req = c.reduce((a,r)=>a+r.total,0), ok = c.reduce((a,r)=>a+r.ok,0);
    if (ok >= req) continue;
    console.log(`\n=== ${j.language}/${j.variant} ${(j.levels||[]).join("/")} (${j.id}) ${ok}/${req} ===`);
    for (const r of c) console.log(`   ${r.type.padEnd(20)} featured=${r.featured} ${r.ok}/${r.total} falta ${r.total-r.ok}`);

    // por historia
    const per: any[] = await prisma.$queryRawUnsafe(`
      SELECT st.slug, st.topic, st."slotIndex",
             count(*) FILTER (WHERE ex.type='meaning_in_context')::int w_req,
             count(*) FILTER (WHERE ex.type='meaning_in_context' AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'')::int w_ok,
             count(*) FILTER (WHERE ex.type='fill_blank')::int s_req,
             count(*) FILTER (WHERE ex.type='fill_blank' AND coalesce(ex.payload->'audioClip'->>'clipUrl','')<>'')::int s_ok,
             min(ps."createdAt") set_created, max(ps."updatedAt") set_updated
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
      WHERE st."journeyId"=$1 AND ex.type IN ('meaning_in_context','fill_blank')
      GROUP BY 1,2,3 ORDER BY 2,3`, j.id);
    for (const p of per) {
      console.log(`   ${p.slug.slice(0,38).padEnd(38)} pal ${p.w_ok}/${p.w_req}  fra ${p.s_ok}/${p.s_req}  set ${p.set_created?.toISOString?.().slice(0,10)}→${p.set_updated?.toISOString?.().slice(0,10)}`);
    }
  }
  await prisma.$disconnect();
})().catch(async (e)=>{console.error(e); await prisma.$disconnect(); process.exit(1);});
