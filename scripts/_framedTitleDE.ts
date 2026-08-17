/**
 * Título "cerrado" para historias cuyo título es un sintagma nominal pelado que
 * el TTS lee con entonación de continuación (suena a pregunta). Truco: sintetiza
 * el título DENTRO de una oración declarativa completa (que CAE al final), pide
 * timestamps por carácter, y RECORTA el marco delantero en el límite de palabra.
 * El clip resultante conserva la caída de fin-de-oración; el título mostrado
 * queda limpio. GATED (ElevenLabs). Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_framedTitleDE.ts <slug> "<frame prefix>" [stability] [speed] [style]
 *   ej: _framedTitleDE.ts gru-e-von-timo "Das sind " 0.7 0.8 0
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { replaceSectionAndRebuild } from "../src/lib/audioEditorSections";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const MORITZ = "Ww7Sq9tx9CCOiNOwWgsx";
const MODEL = "eleven_multilingual_v2";

async function ttsTimestamps(text: string, stability: number, speed: number, style: number) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no ELEVENLABS_API_KEY");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MORITZ}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      text, model_id: MODEL,
      voice_settings: { stability, similarity_boost: 0.8, style, speed, use_speaker_boost: true },
      apply_text_normalization: "on",
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j: any = await res.json();
  const audio = Buffer.from(j.audio_base64, "base64");
  const al = j.alignment ?? j.normalized_alignment;
  return { audio, chars: al.characters as string[], starts: al.character_start_times_seconds as number[] };
}

async function run() {
  const slug = process.argv[2];
  const frame = process.argv[3] ?? "Das sind ";
  const stability = process.argv[4] ? Number(process.argv[4]) : 0.7;
  const speed = process.argv[5] ? Number(process.argv[5]) : 0.8;
  const style = process.argv[6] ? Number(process.argv[6]) : 0;
  if (!slug) { console.error("uso: _framedTitleDE.ts <slug> <frame> [stability] [speed] [style]"); process.exit(1); }
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug, journeyId: "cmroo4w4v0000324ow1o9qlcp" }, select: { id: true, title: true, audioUrl: true } });
  if (!s?.title || !s.audioUrl) { console.error("sin título o sin audio"); process.exit(1); }
  const cleanTitle = s.title.trim().replace(/[.!…]+$/, "");
  const full = `${frame}${cleanTitle}.`;
  console.log(`[${slug}] TTS oración marco="${full}" (recorto "${frame}")`);
  const { audio, chars, starts } = await ttsTimestamps(full, stability, speed, style);

  // localizar el inicio de la primera letra del título (justo tras el marco)
  const joined = chars.join("");
  const idx = frame.length; // el marco es prefijo exacto del texto
  if (joined.slice(0, frame.length) !== frame) { console.error(`marco no coincide: "${joined.slice(0,frame.length)}"`); process.exit(1); }
  const cutSec = Math.max(0, (starts[idx] ?? 0) - 0.02);
  console.log(`[${slug}] corte en ${cutSec.toFixed(3)}s (char[${idx}]="${chars[idx]}")`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "framed_"));
  const inMp3 = path.join(tmp, "full.mp3");
  const outMp3 = path.join(tmp, "trim.mp3");
  fs.writeFileSync(inMp3, audio);
  execFileSync("ffmpeg", ["-y", "-ss", cutSec.toFixed(3), "-i", inMp3, "-af", "afade=t=in:st=0:d=0.015", "-acodec", "libmp3lame", "-q:a", "2", outMp3], { stdio: "ignore" });
  const trimmed = fs.readFileSync(outMp3);

  const res = await replaceSectionAndRebuild({ storyId: s.id, fragmentIndex: 0, newSectionBuffer: trimmed, newText: cleanTitle + ".", normalizeSection: true });
  console.log(`[${slug}] new master: ${res.audioUrl}`);
  try { await generateWordTimingsForStory(s.id); console.log(`[${slug}] re-align OK`); }
  catch (e: any) { console.warn(`[${slug}] align: ${e.message?.slice(0, 80)}`); }
  await prisma.$disconnect();
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
