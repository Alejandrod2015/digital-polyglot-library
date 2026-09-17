/**
 * Genera el clip de FRASE COMPLETA de los ejercicios `fill_blank` de una
 * historia, leyendo y escribiendo la base DIRECTAMENTE (sin `scripts/_sets`,
 * a diferencia de `_genPracticeClips.ts`). Es el puente que falta para el
 * "Practice-audio gate" de `POST /api/studio/journeys/publish`, que exige
 * `payload.audioClip.clipUrl` en cada fill_blank antes de poder publicar.
 *
 * Patrón de `_genWordClips.ts`: lee `practiceSet.exercises` de la historia,
 * ElevenLabs-only, voz `practiceVoiceId(story)`, `assertVoiceApproved`,
 * escribe el payload con SQL crudo sobre `dp_story_practice_exercises_v1`.
 * La síntesis en sí (modelo, framing previous/next_text, loudnorm) es la de
 * `_genPracticeClips.ts`, porque es frase completa y no palabra suelta.
 *
 * EL ENCUADRE VA POR IDIOMA, igual que el `WORD_CARRIER` de `_genWordClips.ts`:
 * un mapa `FRAMING`, no un `if` suelto, para que añadir una lengua sea una fila
 * y no una rama. El texto de `previous_text` / `next_text` NO se sintetiza: es
 * contexto de prosodia, y en el idioma equivocado empuja el acento de la voz.
 * Si el idioma del journey no está en el mapa, el script FALLA: antes de
 * generar hay que escribir sus cuatro frases y leerlas.
 *
 * GATE F0 CERRADO (a propósito, distinto de los otros dos generadores): si
 * `_f0gate.py` no corre (venv/parselmouth ausente) o falla al parsear, la
 * toma NO se sube. Los otros dos gates dejan pasar cuando el gate no corre
 * ("best-effort"); este journey ya tuvo un caso ("costar") donde eso costó
 * una duda evitable, así que aquí se prefiere bloquear a medir a ciegas.
 *
 * Run: npx tsx scripts/_genFillBlankClips.ts <slug> [--only=w1,w2] [--force] [--dry]
 * `--dry` no sintetiza nada: solo lista las frases, sus caracteres y si ya
 * tienen clipUrl. Pasa sin el verbo de audio.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { isWhQuestion } from "../src/lib/whQuestions";

const prisma = new PrismaClient();
let VOICE = "";
let FRAME: Framing;
let LANGUAGE = "";
const MODEL = "eleven_multilingual_v2"; // frase completa: v2, no turbo (ver _genPracticeClips.ts)
const CACHE_VERSION = "fb1";
const MAX_TRIES = 6;
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true };
// Encuadre por idioma. Mismo criterio que _genPracticeClips.ts: el contexto
// neutro corrige el sesgo de subida al final que muestra multilingual_v2 en
// frases cortas sueltas, y la pareja `q` hace que una pregunta suene a
// pregunta. Nada de esto se oye en el clip; solo condiciona la prosodia.
type Framing = { prev: string; next: string; prevq: string; nextq: string };
const FRAMING: Record<string, Framing> = {
  spanish: {
    prev: "Ahora escucha esta frase.",
    next: "Muy bien. Ahora sigamos con la siguiente.",
    prevq: "Él tiene una duda y pregunta:",
    nextq: "Ella le responde enseguida.",
  },
  french: {
    prev: "Écoute cette phrase.",
    next: "Très bien. Passons à la suivante.",
    prevq: "Il a un doute et demande:",
    nextq: "Elle lui répond tout de suite.",
  },
};
function resolveFraming(language: string | null | undefined): Framing {
  const f = FRAMING[(language ?? "").toLowerCase()];
  if (!f) throw new Error(`idioma no soportado aun: ${language} (añade su encuadre a FRAMING)`);
  return f;
}
// Una wh-question ("Où est...?", "Combien coûte...?") termina cayendo por
// naturaleza; solo una pregunta de sí/no exige la subida final del gate F0
// (ver src/lib/whQuestions.ts, compartido con _genPracticeClips.ts). Sin esto
// "Où est la bibliothèque près d'ici?" (la-chaise-du-jeudi) agotaba los 6
// intentos del gate: no hay entonación que la haga subir sin sonar rara,
// porque no debe subir.
const isQuestion = (s: string) => s.trim().endsWith("?") && !isWhQuestion(LANGUAGE, s);
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0, 150)}`)))); });
}
function probe(f: string): Promise<number> {
  return new Promise((res) => { const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (c) => (o += c)); p.on("close", () => res(parseFloat(o.trim()) || 0)); });
}
function spawnCap(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res) => { const p = spawn(cmd, args); let o = "", e = ""; p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c)); p.on("error", () => res({ code: -1, out: o, err: e })); p.on("close", (c) => res({ code: c ?? -1, out: o, err: e })); });
}
function key(voice: string, sentence: string): string {
  const hash = crypto.createHash("sha256").update(`${CACHE_VERSION}|${voice}|${sentence}`).digest("hex").slice(0, 20);
  return `media/practice/sentence-clip/${hash}.mp3`;
}
async function tts(text: string, apiKey: string): Promise<Buffer> {
  assertVoiceApproved(VOICE, "fill-blank-clip");
  const q = isQuestion(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, previous_text: q ? FRAME.prevq : FRAME.prev, next_text: q ? FRAME.nextq : FRAME.next, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text()).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
async function normalize(raw: Buffer, outPath: string): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), "fb-")); const i = join(dir, "i.mp3");
  try {
    writeFileSync(i, raw);
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.12", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
    return probe(outPath);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
/** GATE CERRADO: si el gate no corre o no se puede parsear, ok=false. */
async function f0Ok(mp3Path: string, sentence: string): Promise<{ ok: boolean; detail: string }> {
  const mode = isQuestion(sentence) ? "question" : "statement";
  const r = await spawnCap(F0_PYTHON, ["scripts/_f0gate.py", mp3Path, mode]);
  if (r.code !== 0) return { ok: false, detail: `gate no corrio (${r.err.slice(0, 100) || "sin detalle"})` };
  try {
    const v = JSON.parse(r.out.trim());
    return { ok: !!v.ok, detail: `${v.reason} (slope ${v.slope}, end ${v.end})` };
  } catch { return { ok: false, detail: "gate no se pudo parsear" }; }
}
async function renderSentence(sentence: string, apiKey: string, outPath: string): Promise<{ ok: boolean; dur: number; tries: number; detail: string }> {
  let last = "sin intentos";
  for (let t = 1; t <= MAX_TRIES; t++) {
    try {
      const raw = await tts(sentence, apiKey);
      const dur = await normalize(raw, outPath);
      const f0 = await f0Ok(outPath, sentence);
      last = f0.detail;
      if (!f0.ok) continue;
      return { ok: true, dur, tries: t, detail: f0.detail };
    } catch (e) { last = e instanceof Error ? e.message : String(e); }
  }
  return { ok: false, dur: 0, tries: MAX_TRIES, detail: last };
}

(async () => {
  const slug = process.argv[2];
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((w) => w.trim().toLowerCase())) : null;
  if (!slug) throw new Error("usage: _genFillBlankClips.ts <slug> [--only=w1,w2] [--force] [--dry]");

  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { voiceId: true, practiceVoiceId: true, journey: { select: { language: true } }, practiceSet: { select: { exercises: { select: { id: true, word: true, type: true, payload: true } } } } },
  });
  if (!story?.practiceSet) throw new Error(`no practice set for ${slug}`);
  const framing = resolveFraming(story.journey?.language);
  const voice = practiceVoiceId(story);
  let targets = story.practiceSet.exercises.filter((e) => e.type === "fill_blank" && (e.payload as any)?.audioClip?.sentence);
  if (only) targets = targets.filter((e) => only.has((e.word || "").trim().toLowerCase()));

  if (dry) {
    let chars = 0, pendientes = 0;
    console.log(`${slug}: voz=${voice} | lang=${story.journey?.language} | ${targets.length} fill_blank`);
    console.log(`  encuadre: "${framing.prev}" / "${framing.next}" | pregunta: "${framing.prevq}" / "${framing.nextq}"`);
    for (const e of targets) {
      const ac: any = (e.payload as any).audioClip;
      const sentence: string = ac.sentence;
      chars += sentence.length;
      const yaTiene = !!ac.clipUrl && !force;
      if (!yaTiene) pendientes++;
      console.log(`  ${yaTiene ? "· ya tiene clip" : "○ pendiente"}  [${sentence.length}c] "${e.word}": ${sentence}`);
    }
    console.log(`  total: ${targets.length} frases, ${pendientes} pendientes, ${chars} caracteres`);
    return { slug, total: targets.length, pendientes, chars };
  }

  const apiKey = process.env.ELEVENLABS_API_KEY; if (!apiKey) throw new Error("no ELEVENLABS_API_KEY");
  VOICE = voice;
  FRAME = framing;
  LANGUAGE = story.journey?.language ?? "";
  console.log(`${slug}: voz=${voice} | lang=${story.journey?.language} | ${targets.length} fill_blank`);
  const outDir = mkdtempSync(join(tmpdir(), "fbout-"));
  let ok = 0;
  for (const e of targets) {
    const ac: any = (e.payload as any).audioClip;
    const sentence: string = ac.sentence;
    if (ac.clipUrl && !force) { ok++; continue; }
    const outPath = join(outDir, "s.mp3");
    const res = await renderSentence(sentence, apiKey, outPath);
    if (!res.ok) { console.log(`  ✗ "${e.word}" (${res.detail})`); continue; }
    const k = key(voice, sentence);
    await uploadPublicObject({ key: k, body: readFileSync(outPath), contentType: "audio/mpeg" });
    const url = getPublicObjectUrl(k);
    const newPayload = { ...(e.payload as any), audioClip: { ...ac, clipUrl: url, voiceId: voice } };
    await prisma.$executeRawUnsafe(`UPDATE dp_story_practice_exercises_v1 SET payload=$1::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`, JSON.stringify(newPayload), e.id);
    console.log(`  ✓ "${e.word}" [${res.tries}t] ${res.detail} → ${url.slice(-24)}`);
    ok++;
  }
  console.log(`\n${ok}/${targets.length} listos`);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
