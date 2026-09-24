/**
 * Restaura `payload.audioClip.wordClipUrl` de los ejercicios de significado SIN
 * sintetizar nada. Hermano de `_restoreClipUrls.ts` (que hace lo mismo con la
 * frase de los `fill_blank`), para el hueco que abrio el resembrado del
 * 2026-09-18: `scripts/_sets/*.json` nunca ha llevado `wordClipUrl`, asi que el
 * delete-and-reinsert del seed borraba el puntero aunque el mp3 siguiera en R2.
 *
 * La clave de un clip de palabra es deterministica:
 *   sha256(`<version>|<voz>|<palabra en minusculas>`).slice(0,20)
 * bajo `media/practice/word-clip/`. Se prueban las versiones vivas (w5 es la
 * receta actual; w4 la de los clips de match; w3 la primera, 2026-07-23) y se
 * escribe SOLO si un HEAD contra R2 devuelve 200. Si la sonda falla, la fila no
 * se toca y sale en el informe: nunca se escribe a ciegas.
 *
 *   npx tsx scripts/_restoreWordClipUrls.ts <journeyId> [--apply] [--slug=<slug>]
 * Sin --apply solo informa.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";

const prisma = new PrismaClient();
const WORD_CLIP_VERSIONS = ["w5", "w4", "w3", "w2", "w1"];

function wordKey(version: string, voice: string, word: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${version}|${voice}|${word.toLowerCase()}`)
    .digest("hex")
    .slice(0, 20);
  return `media/practice/word-clip/${hash}.mp3`;
}

async function head(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { method: "HEAD" })).status === 200;
  } catch {
    return false;
  }
}

(async () => {
  const journeyId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
  if (!journeyId) throw new Error("usage: _restoreWordClipUrls.ts <journeyId> [--apply] [--slug=x]");

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, ...(slugArg ? { slug: slugArg } : {}) },
    select: {
      slug: true, voiceId: true, practiceVoiceId: true,
      practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, featured: true, payload: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  let found = 0, missing = 0, already = 0, written = 0;
  const misses: string[] = [];
  // Una palabra repetida en varias historias comparte clave si comparte voz:
  // la sonda se cachea para no repetir el HEAD.
  const probe = new Map<string, string | null>();

  for (const s of stories) {
    const voice = practiceVoiceId(s as any);
    let f = 0, m = 0;
    for (const e of s.practiceSet?.exercises ?? []) {
      if (e.type !== "meaning_in_context") continue;
      const payload = e.payload as any;
      const ac = payload?.audioClip;
      if (!ac) continue;
      if (ac.wordClipUrl) { already++; continue; }
      const word = (e.word || "").trim();
      if (!word) continue;

      const cacheKey = `${voice}|${word.toLowerCase()}`;
      let hitUrl = probe.get(cacheKey);
      if (hitUrl === undefined) {
        hitUrl = null;
        for (const v of WORD_CLIP_VERSIONS) {
          const url = getPublicObjectUrl(wordKey(v, voice, word));
          if (!url) throw new Error("sin config de almacenamiento");
          if (await head(url)) { hitUrl = url; break; }
        }
        probe.set(cacheKey, hitUrl);
      }
      if (!hitUrl) { m++; missing++; misses.push(`${s.slug} · ${e.word}${e.featured === false ? " [pool]" : ""}`); continue; }
      f++; found++;
      if (apply) {
        const next = { ...payload, audioClip: { ...ac, wordClipUrl: hitUrl, wordVoiceId: voice } };
        await prisma.$executeRawUnsafe(
          `UPDATE dp_story_practice_exercises_v1 SET payload = $1::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
          JSON.stringify(next), e.id);
        written++;
      }
    }
    if (f || m) console.log(`  ${s.slug.padEnd(34)} en R2 ${String(f).padStart(3)} · sonda fallida ${String(m).padStart(3)}`);
  }

  if (misses.length) {
    console.log(`\nsin objeto en R2 (${misses.length}), NO se toca ninguna:`);
    for (const x of misses) console.log("  " + x);
  }
  console.log(`\nTOTAL: ${found} en R2, ${missing} sin objeto, ${already} ya tenian wordClipUrl${apply ? ` · escritos ${written}` : " (dry)"}`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
