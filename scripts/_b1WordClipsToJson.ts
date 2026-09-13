/** Copia a scripts/_sets/<slug>.json los wordClipUrl que _genWordClips.ts escribio
 *  SOLO en la base. El cargador (_seedAllSets.ts) reinserta el payload entero
 *  desde el JSON, asi que sin esta copia la siguiente recarga borraria el audio
 *  de palabra de todos los meaning_in_context y el movil volveria a sonar mudo.
 *
 *  Casa por (type, word), que es unico dentro de un set (el validador lo exige).
 *  uso: npx tsx scripts/_b1WordClipsToJson.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY = "cmtmylg7k0007321h6t7njesx";
const p = new PrismaClient();

(async () => {
  const dry = process.argv.includes("--dry");
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, practiceSet: { select: { exercises: { select: { type: true, word: true, payload: true } } } } },
  });
  let copiados = 0, faltanEnBase = 0;
  for (const s of stories) {
    const f = `scripts/_sets/${s.slug}.json`;
    if (!fs.existsSync(f) || !s.practiceSet) { console.log(`${s.slug}: sin fichero o sin set`); continue; }
    const db = new Map<string, any>();
    for (const e of s.practiceSet.exercises) db.set(`${e.type}|${e.word}`, (e.payload as any)?.audioClip ?? {});
    const exs: any[] = JSON.parse(fs.readFileSync(f, "utf8"));
    let n = 0;
    for (const e of exs) {
      if (e.type !== "meaning_in_context") continue;
      const ac = db.get(`${e.type}|${e.word}`);
      if (!ac?.wordClipUrl) { faltanEnBase++; continue; }
      e.payload ??= {}; e.payload.audioClip ??= {};
      if (e.payload.audioClip.wordClipUrl !== ac.wordClipUrl) {
        e.payload.audioClip.wordClipUrl = ac.wordClipUrl;
        e.payload.audioClip.wordVoiceId = ac.wordVoiceId;
        n++;
      }
    }
    if (n && !dry) fs.writeFileSync(f, JSON.stringify(exs, null, 2) + "\n");
    copiados += n;
    console.log(`${(s.slug ?? "").padEnd(26)} ${n} copiados`);
  }
  console.log(`\ncopiados ${copiados}${dry ? " (dry)" : ""} · meaning sin wordClipUrl en la base: ${faltanEnBase}`);
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
