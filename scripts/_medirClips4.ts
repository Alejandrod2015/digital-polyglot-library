/** MEDICION: caracteres que costaria cerrar el hueco (no sintetiza nada). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const IDS: [string, string][] = [
  ["es/spain a1", "cmsvz6mz9000732gsgsfer0ko"],
  ["es/latam a2", "cmtgelq560007j84n3ujx9bpd"],
  ["es/latam c1", "cmrdqk484000032r4rt2vw4ej"],
  ["fr/france a1", "cmtwz1iop000l32jybeo2jg4x"],
  ["es/mexico a1", "cmrrqjd2n000032nvnp2tryzg"],
];
(async () => {
  let gw = 0, gs = 0, gwc = 0, gsc = 0;
  for (const [label, id] of IDS) {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT ex.type, ex.word, ex.payload->'audioClip'->>'sentence' sent
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId"=st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId"=ps.id
      WHERE st."journeyId"=$1 AND ex.type IN ('meaning_in_context','fill_blank')
        AND NOT ((ex.type='meaning_in_context' AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','')<>'')
              OR (ex.type='fill_blank' AND coalesce(ex.payload->'audioClip'->>'clipUrl','')<>''))`, id);
    let w = 0, s = 0, wc = 0, sc = 0;
    for (const r of rows) {
      if (r.type === "meaning_in_context") { w++; wc += (r.word || "").length + 1; }
      else { s++; sc += (r.sent || "").length + 1; }
    }
    console.log(`${label.padEnd(14)} palabras ${String(w).padStart(3)} (${wc} car) · frases ${String(s).padStart(3)} (${sc} car)`);
    gw += w; gs += s; gwc += wc; gsc += sc;
  }
  console.log(`TOTAL palabras ${gw} (${gwc} car) · frases ${gs} (${gsc} car) · suma ${gwc + gsc} car (1 toma)`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
