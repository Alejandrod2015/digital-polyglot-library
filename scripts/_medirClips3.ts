/**
 * MEDICION (no escribe nada, no sintetiza nada): para cada ejercicio de
 * significado sin `wordClipUrl` en los journeys LIVE, recalcula la clave R2
 * deterministica del generador de clips de palabra (sha256(ver|voz|palabra))
 * en todas sus versiones y comprueba con HEAD si el mp3 EXISTE.
 *   existe  -> el clip se genero y el payload lo perdio (resembrado): gratis.
 *   no      -> nunca se genero: hay que pagarlo.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";

const prisma = new PrismaClient();
const VERS = ["w5", "w4", "w3", "w2", "w1"];
function wkey(ver: string, voice: string, word: string) {
  const h = crypto.createHash("sha256").update(`${ver}|${voice}|${word.toLowerCase()}`).digest("hex").slice(0, 20);
  return `media/practice/word-clip/${h}.mp3`;
}
async function head(url: string) { try { return (await fetch(url, { method: "HEAD" })).status === 200; } catch { return false; } }

const IDS: [string, string][] = [
  ["spanish/spain traveler a1", "cmsvz6mz9000732gsgsfer0ko"],
  ["spanish/latam traveler a2", "cmtgelq560007j84n3ujx9bpd"],
  ];

(async () => {
  for (const [label, id] of IDS) {
    const stories = await prisma.journeyStory.findMany({
      where: { journeyId: id },
      select: { slug: true, voiceId: true, practiceVoiceId: true, practiceSet: { select: { exercises: { select: { type: true, word: true, featured: true, payload: true } } } } },
      orderBy: { createdAt: "asc" },
    });
    let enR2 = 0, sinR2 = 0, enR2f = 0, sinR2f = 0, palabrasUnicasFaltan = new Set<string>();
    const muestraSinR2: string[] = [];
    const cache = new Map<string, boolean>();
    for (const s of stories) {
      const voice = practiceVoiceId(s as any);
      for (const e of s.practiceSet?.exercises ?? []) {
        if (e.type !== "meaning_in_context") continue;
        const ac = (e.payload as any)?.audioClip ?? {};
        if (ac.wordClipUrl) continue;
        const w = (e.word || "").trim(); if (!w) continue;
        palabrasUnicasFaltan.add(`${voice}|${w.toLowerCase()}`);
        const ck = `${voice}|${w.toLowerCase()}`;
        let hit = cache.get(ck);
        if (hit === undefined) {
          hit = false;
          for (const v of VERS) { const u = getPublicObjectUrl(wkey(v, voice, w)); if (u && await head(u)) { hit = true; break; } }
          cache.set(ck, hit);
        }
        if (hit) { enR2++; if (e.featured !== false) enR2f++; } else { if (e.featured !== false) sinR2f++; sinR2++; if (muestraSinR2.length < 5) muestraSinR2.push(`${s.slug} · ${w}`); }
      }
    }
    console.log(`\n### ${label}`);
    console.log(`   mic sin wordClipUrl: ${enR2 + sinR2} (unicos ${palabrasUnicasFaltan.size}) · EN R2: ${enR2} (featured ${enR2f}) · SIN R2: ${sinR2} (featured ${sinR2f})`);
    if (muestraSinR2.length) console.log(`   muestra sin R2: ${muestraSinR2.join(" | ")}`);
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
