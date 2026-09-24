import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma: any = new PrismaClient();

const IDS: Record<string, string> = {
  "es/spain a1": "cmsvz6mz9000732gsgsfer0ko",
  "es/latam a2": "cmtgelq560007j84n3ujx9bpd",
  "es/latam c1": "cmrdqk484000032r4rt2vw4ej",
  "fr/france a1": "cmtwz1iop000l32jybeo2jg4x",
  "es/mexico a1": "cmrrqjd2n000032nvnp2tryzg",
};

(async () => {
  for (const [label, id] of Object.entries(IDS)) {
    console.log(`\n### ${label}`);
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT ex.type, ex.word, ex.featured, ex.payload->'audioClip' clip, ps."createdAt" sc, ps."updatedAt" su
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
      WHERE st."journeyId"=$1 AND ex.type IN ('meaning_in_context','fill_blank')
        AND NOT ((ex.type='meaning_in_context' AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'')
              OR (ex.type='fill_blank' AND coalesce(ex.payload->'audioClip'->>'clipUrl','')<>''))
      LIMIT 3`, id);
    for (const r of rows) console.log(" FALTA", r.type, r.word, "featured=", r.featured, JSON.stringify(r.clip)?.slice(0, 300));
    const okrow: any[] = await prisma.$queryRawUnsafe(`
      SELECT ex.type, ex.word, ex.payload->'audioClip' clip
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
      WHERE st."journeyId"=$1 AND ex.type='meaning_in_context'
        AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'' LIMIT 1`, id);
    for (const r of okrow) console.log(" OK   ", r.type, r.word, JSON.stringify(r.clip)?.slice(0, 300));
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
