import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma: any = new PrismaClient();
const IDS: [string,string][] = [
  ["es/spain a1","cmsvz6mz9000732gsgsfer0ko"],["es/latam a2","cmtgelq560007j84n3ujx9bpd"],
  ["es/latam c1","cmrdqk484000032r4rt2vw4ej"],["fr/france a1","cmtwz1iop000l32jybeo2jg4x"],
  ["es/mexico a1","cmrrqjd2n000032nvnp2tryzg"]];
(async()=>{
 for(const [label,id] of IDS){
  const r:any[] = await prisma.$queryRawUnsafe(`
    SELECT ex.featured, ex.type,
      min(ex."createdAt") c0, max(ex."createdAt") c1, min(ex."updatedAt") u0, max(ex."updatedAt") u1, count(*)::int n
    FROM "dp_journey_stories_v1" st
    JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
    JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
    WHERE st."journeyId"=$1 AND ex.type IN ('meaning_in_context','fill_blank')
      AND NOT ((ex.type='meaning_in_context' AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'')
            OR (ex.type='fill_blank' AND coalesce(ex.payload->'audioClip'->>'clipUrl','')<>''))
    GROUP BY 1,2`, id);
  console.log(`\n${label}`);
  for(const x of r) console.log(`  ${x.type} featured=${x.featured} n=${x.n} creado ${x.c0?.toISOString().slice(0,16)}..${x.c1?.toISOString().slice(0,16)} actualizado ${x.u0?.toISOString().slice(0,16)}..${x.u1?.toISOString().slice(0,16)}`);
 }
 await prisma.$disconnect();
})().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1);});
