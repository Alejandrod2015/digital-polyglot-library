/** Cuanto del audio ya rendido sirve para el texto NUEVO: calcula la clave de
 *  cache de cada fragmento y pregunta a R2 si ya existe. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2 } from "../src/lib/elevenlabs";
import { getPublicObjectUrl } from "../src/lib/objectStorage";
const p = new PrismaClient();
const key = (v: string, t: string) => `media/multivoice-segments/${crypto.createHash("sha256")
  .update(`${v}|${ELEVENLABS_MODEL_V2}|${JSON.stringify(DEFAULT_VOICE_SETTINGS)}|${softenPunctuationForTts(t)}|trim-v7-noprev`)
  .digest("hex").slice(0, 24)}.mp3`;
(async () => {
  let hits = 0, total = 0, charHit = 0, charTot = 0;
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true, voiceId: true } });
    if (!s?.text || !s.voiceId) continue;
    const titulo = /[.!?…:]$/.test(s.title!) ? s.title! : `${s.title}.`;
    const frags = [titulo, ...s.text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)];
    let h = 0;
    for (const f of frags) {
      const url = getPublicObjectUrl(key(s.voiceId, f));
      const ok = url ? (await fetch(url, { method: "HEAD" })).ok : false;
      total++; charTot += f.length;
      if (ok) { h++; hits++; charHit += f.length; console.log(`   HIT: ${f.slice(0, 70)}`); }
    }
    console.log(`${slug.padEnd(24)} ${h}/${frags.length} fragmentos ya en cache`);
  }
  console.log(`\nTOTAL ${hits}/${total} fragmentos · ${charHit}/${charTot} caracteres reutilizables (${Math.round((charHit / charTot) * 100)}%)`);
  await p.$disconnect();
})();
