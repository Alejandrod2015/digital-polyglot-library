/**
 * Restaura `payload.audioClip.clipUrl` de los ejercicios de practica SIN
 * sintetizar nada: los mp3 siguen en R2 bajo la clave deterministica que
 * escribe el generador de clips de frase (sha256 de version|voz|frase[|rN]),
 * asi que basta recalcular la clave, comprobar con HEAD que el objeto existe y
 * escribir la URL en el payload. Uso:
 *   npx tsx scripts/_restoreClipUrls.ts <journeyId> [--apply] [--slug=<slug>]
 * Sin --apply solo informa. Con --slug limita a una historia.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";
const prisma = new PrismaClient();
// Dos generadores, dos formulas de clave, la misma carpeta R2:
// - meaning_in_context: _genPracticeClips.ts -> sha256(version|voz|frase[|rN]).slice(0,16)
// - fill_blank: _genFillBlankClips.ts -> sha256("fb1"|voz|frase).slice(0,20), SIN rev
const MIC_VERSIONS = ["v4", "v3", "v2"];
const REVS = [0, 1, 2, 3];
function micKey(version: string, voice: string, sentence: string, rev: number): string {
  const hash = crypto.createHash("sha256").update(`${version}|${voice}|${sentence}${rev ? `|r${rev}` : ""}`).digest("hex").slice(0, 16);
  return `media/practice/sentence-clip/${hash}.mp3`;
}
function fbKey(voice: string, sentence: string): string {
  const hash = crypto.createHash("sha256").update(`fb1|${voice}|${sentence}`).digest("hex").slice(0, 20);
  return `media/practice/sentence-clip/${hash}.mp3`;
}
function candidateKeys(type: string, voice: string, sentence: string): string[] {
  const keys: string[] = [];
  // fill_blank puede venir de CUALQUIERA de los dos generadores:
  // _genFillBlankClips.ts (clave fb1, sin rev) o _genPracticeClips.ts, que
  // desde su origen trata fill_blank igual que meaning_in_context (clave
  // v4/v3/v2 con rev). Probar ambas evita declarar "sin objeto" un clip que
  // sí está en R2 bajo la otra formula.
  if (type === "fill_blank") keys.push(fbKey(voice, sentence));
  for (const v of MIC_VERSIONS) for (const rev of REVS) keys.push(micKey(v, voice, sentence, rev));
  return keys;
}
async function head(url: string): Promise<boolean> {
  const r = await fetch(url, { method: "HEAD" });
  return r.status === 200;
}
(async () => {
  const journeyId = process.argv[2];
  const apply = process.argv.includes("--apply");
  const slugArg = process.argv.find((a) => a.startsWith("--slug="))?.slice(7);
  if (!journeyId) throw new Error("usage: _restoreClipUrls.ts <journeyId> [--apply] [--slug=x]");
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, ...(slugArg ? { slug: slugArg } : {}) },
    select: { slug: true, voiceId: true, practiceVoiceId: true, practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, payload: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  let found = 0, missing = 0, already = 0, written = 0;
  const misses: string[] = [];
  for (const s of stories) {
    const voice = practiceVoiceId(s);
    let f = 0, m = 0;
    for (const e of s.practiceSet?.exercises ?? []) {
      if (e.type !== "fill_blank" && e.type !== "meaning_in_context") continue;
      const payload = e.payload as any;
      const ac = payload?.audioClip;
      if (!ac?.sentence) continue;
      if (ac.clipUrl) { already++; continue; }
      let hitUrl: string | null = null;
      for (const key of candidateKeys(e.type, voice, ac.sentence)) {
        const url = getPublicObjectUrl(key);
        if (!url) throw new Error("sin config de almacenamiento");
        if (await head(url)) { hitUrl = url; break; }
      }
      if (!hitUrl) { m++; missing++; misses.push(`${s.slug} · ${e.word} [${e.type}] "${ac.sentence}"`); continue; }
      f++; found++;
      if (apply) {
        const next = { ...payload, audioClip: { ...ac, clipUrl: hitUrl } };
        await prisma.$executeRawUnsafe(
          `UPDATE dp_story_practice_exercises_v1 SET payload = $1::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
          JSON.stringify(next), e.id);
        written++;
      }
    }
    console.log(`${s.slug}: ${f} en R2, ${m} sin objeto${apply ? ` (${f} escritos)` : ""}`);
  }
  console.log(`\nTOTAL: ${found} en R2, ${missing} sin objeto, ${already} ya tenian clipUrl${apply ? `, ${written} escritos` : " (dry)"}`);
  if (misses.length) console.log("SIN OBJETO:\n  " + misses.join("\n  "));
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
