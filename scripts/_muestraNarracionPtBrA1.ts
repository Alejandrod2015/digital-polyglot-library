/**
 * MUESTRA de narración: título + primer párrafo de UNA historia del
 * Traveler PT-BR A1, por el MISMO camino que el render completo
 * (`generateAndUploadMultiVoiceAudio`, misma voz, mismos settings,
 * `disableStitching: true`). No es un test desechable:
 *
 *   la caché de segmentos es CONTENT-ADDRESSED
 *   (`voiceId|model|settings|softenedText|trim-v7-noprev`), así que las tomas
 *   que se aprueben aquí son EXACTAMENTE las que usará el render completo:
 *   cache hit, cero créditos, cero regeneración.
 *
 * NO escribe en la fila de la historia (el render completo aborta si ya hay
 * `audioUrl`), y sube la muestra a `media/review/` para poder enlazarla.
 * El segundo mp3 lleva ya el pacing del journey (atempo hacia 2,45 pal/s),
 * que es lo que se aplica al máster al final.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "../src/generated/prisma";
import {
  generateAndUploadMultiVoiceAudio,
  softenPunctuationForTts,
  DEFAULT_VOICE_SETTINGS,
  ELEVENLABS_MODEL_V2,
} from "../src/lib/elevenlabs";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { uploadPublicObject, getPublicObjectUrl } from "../src/lib/objectStorage";

const JOURNEY_ID = "cmsyrge55000732u9oiu8wue3";
const TARGET_RATE = 2.45;

function cacheKey(voiceId: string, texto: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(
      `${voiceId}|${ELEVENLABS_MODEL_V2}|${JSON.stringify(DEFAULT_VOICE_SETTINGS)}|` +
        `${softenPunctuationForTts(texto)}|trim-v7-noprev`
    )
    .digest("hex")
    .slice(0, 24);
  return `media/multivoice-segments/${hash}.mp3`;
}

async function existe(key: string): Promise<boolean> {
  const url = getPublicObjectUrl(key);
  if (!url) return false;
  try { return (await fetch(url, { method: "HEAD" })).ok; } catch { return false; }
}

async function run() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const publicar = args.includes("--en-la-historia");
  const slug = args.find((a) => !a.startsWith("--")) ?? "a-rede-do-conves";
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug, journeyId: JOURNEY_ID }, include: { journey: true },
  });
  if (!story?.text || !story.title || !story.voiceId) { console.error("historia sin texto/título/voz"); process.exit(1); }
  assertVoiceApproved(story.voiceId, `ptbr-a1-muestra:${slug}`);

  const parrafo = story.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)[0];
  const tituloSeg = /[.!?…:]$/.test(story.title) ? story.title : `${story.title}.`;
  const chars = tituloSeg.length + parrafo.length;
  console.log(`[muestra] ${slug} · voz ${story.voiceId} · ${chars} caracteres`);
  console.log(`  título:  ${tituloSeg}`);
  console.log(`  párrafo: ${parrafo}`);

  const claves = { titulo: cacheKey(story.voiceId, tituloSeg), parrafo: cacheKey(story.voiceId, parrafo) };
  for (const [k, v] of Object.entries(claves)) console.log(`  caché ${k}: ${v} · ${(await existe(v)) ? "YA EXISTE" : "no existe todavía"}`);

  if (dry) { console.log("\n--dry: no se sintetiza nada."); await prisma.$disconnect(); return; }

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: parrafo,
    title: story.title,
    voiceMap: { narrator: story.voiceId },
    language: story.journey.language ?? undefined,
    disableStitching: true,
  });
  if (!result) throw new Error("multi-voice devolvió null");
  console.log(`\n[muestra] máster seco: ${result.url}`);
  console.log(`[muestra] QA: ${result.audioQa?.status ?? "-"} ${result.audioQa?.score ?? ""}`);
  if (result.contentMisses?.length) console.log(`[muestra] gate de contenido: ${result.contentMisses.length} avisos`);
  for (const [k, v] of Object.entries(claves)) console.log(`[muestra] caché ${k}: ${(await existe(v)) ? "GUARDADA (el render completo hará hit)" : "NO guardada (revisar)"}`);

  // Pacing del journey: mismo cálculo que normalizeAudioPace (atempo = objetivo/actual).
  const palabras = [tituloSeg, parrafo].join(" ").trim().split(/\s+/).filter(Boolean).length;
  const habla = result.fragments.reduce((a, f) => a + (f.endSec - f.startSec), 0);
  const actual = palabras / habla;
  const atempo = TARGET_RATE / actual;
  console.log(`\n[muestra] ritmo ${actual.toFixed(2)} pal/s → objetivo ${TARGET_RATE} · atempo ${atempo.toFixed(3)}`);

  const dir = mkdtempSync(join(tmpdir(), "muestra-"));
  const seco = join(dir, "seco.mp3"), lento = join(dir, "lento.mp3");
  writeFileSync(seco, Buffer.from(await (await fetch(result.url)).arrayBuffer()));
  const ff = spawnSync("ffmpeg", ["-y", "-i", seco, "-filter:a", `atempo=${atempo.toFixed(4)}`, "-c:a", "libmp3lame", "-q:a", "2", lento], { encoding: "utf8" });
  if (ff.status !== 0) { console.error("ffmpeg falló:", ff.stderr?.slice(-300)); process.exit(1); }
  const up = await uploadPublicObject({
    key: `media/review/${slug}-muestra-pacing.mp3`,
    body: readFileSync(lento), contentType: "audio/mpeg", cacheControl: "no-cache",
  });
  rmSync(dir, { recursive: true, force: true });
  console.log(`[muestra] CON pacing: ${up?.url ?? "(subida falló)"}`);
  if (publicar) {
    // La muestra se OYE dentro de la historia (texto delante, píldoras de vocab).
    // Cubre solo el título y el primer párrafo; se retira con
    // `_clearStaleAudio.ts <slug>` antes del render completo.
    const escala = 1 / atempo;
    await prisma.journeyStory.update({
      where: { id: story.id },
      data: {
        audioUrl: up?.url ?? result.url,
        audioFilename: `${slug}-muestra-pacing.mp3`,
        audioStatus: "ready",
        audioFragments: result.fragments.map((f) => ({
          index: f.index, speaker: f.speaker, voiceId: f.voiceId, text: f.text,
          startSec: Number((f.startSec * escala).toFixed(3)),
          endSec: Number((f.endSec * escala).toFixed(3)),
        })) as never,
      },
    });
    console.log(`[muestra] puesta EN la historia: /stories/${slug} (retirar con _clearStaleAudio.ts antes del render completo)`);
  } else {
    console.log(`[muestra] la fila de la historia NO se tocó (audioUrl sigue ${story.audioUrl ?? "null"})`);
  }
  await prisma.$disconnect();
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
