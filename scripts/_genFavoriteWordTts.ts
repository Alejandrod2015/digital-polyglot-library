/**
 * Hornea el clip de PALABRA de los favoritos que hoy no suenan, en la MISMA
 * clave de cache que usa /api/practice/word-tts.
 *
 * Por que asi y no con _genWordClips.ts: aquel trabaja por historia y hornea el
 * `wordClipUrl` del ejercicio. 45 de las 50 palabras mudas del usuario NO tienen
 * ejercicio (las guardo con el quick lookup), asi que no hay donde colgar el
 * clip. En cambio el endpoint word-tts, antes de sintetizar nada, hace un HEAD
 * contra `media/practice/word-tts/<hash>.mp3` y si existe lo devuelve tal cual
 * (route.ts:188). Escribiendo en esa clave, las palabras suenan sin tocar el
 * endpoint, que hoy revienta porque invoca ffmpeg y en Vercel no hay ffmpeg.
 *
 * GATE F0 (obligatorio, .claude/safety guard 6e): cada render se mide con
 * scripts/_f0gate.py y se RE-TIRA mientras el final SUBA, para que la palabra
 * suene como afirmacion y no como pregunta. Mismo marco declarativo y mismos
 * ajustes que el generador canonico _genWordClips.ts.
 *
 *   npx tsx scripts/_genFavoriteWordTts.ts --lang german [--limit N] [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const prisma = new PrismaClient();

// --- Debe coincidir EXACTAMENTE con src/app/api/practice/word-tts/route.ts ---
const CACHE_VERSION = "v3";
const WORD_MODEL = "eleven_turbo_v2_5";
const LANG_CODES: Record<string, string> = {
  spanish: "es", german: "de", french: "fr", italian: "it", portuguese: "pt", english: "en",
};
const LANG_DEFAULT_VOICE: Record<string, string> = {
  de: "Ww7Sq9tx9CCOiNOwWgsx", // narrador Expat/Friends DE (aprobado)
  it: "gfKKsLN1k0oYYN9n2dXX", // Violetta IT (aprobado)
};
function cacheKey(voiceId: string, word: string, langCode: string): string {
  const langSuffix = langCode === "es" ? "" : `|${langCode}`;
  const payload = `${CACHE_VERSION}|${voiceId}|${word.toLowerCase()}${langSuffix}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `media/practice/word-tts/${hash}.mp3`;
}
// ---------------------------------------------------------------------------

const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const MAX_TRIES = 6;
const CARRIER: Record<string, string> = {
  es: "La palabra es:", de: "Das Wort lautet:", it: "La parola è:",
  fr: "Le mot est:", pt: "A palavra é:", en: "The word is:",
};

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn("ffmpeg", args); let e = "";
    p.stderr.on("data", (c) => (e += c));
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(e.slice(0, 150)))));
  });
}
function spawnCap(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    const p = spawn(cmd, args); let o = "";
    p.stdout.on("data", (c) => (o += c));
    p.on("error", () => res({ code: -1, out: o }));
    p.on("close", (c) => res({ code: c ?? -1, out: o }));
  });
}
async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d = mkdtempSync(join(tmpdir(), "fwt-")); const i = join(d, "i.mp3");
  try {
    writeFileSync(i, raw);
    // Mismo filtro que el endpoint (loudnorm + cola) mas el lead-in de 90 ms que
    // el generador canonico anadio porque el primer autoplay con la sesion de
    // audio en frio recorta el onset.
    await ff(["-y", "-loglevel", "error", "-i", i, "-af",
      "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15,adelay=90:all=1",
      "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
  } finally { rmSync(d, { recursive: true, force: true }); }
}
async function tts(word: string, voice: string, apiKey: string, langCode: string): Promise<Buffer> {
  assertVoiceApproved(voice, "favorite-word-tts");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${word.replace(/[.?!]+$/, "")}.`,
      model_id: WORD_MODEL,
      language_code: langCode,
      voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
      previous_text: CARRIER[langCode] ?? CARRIER.en,
      next_text: " ",
    }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0, 90)}`);
  return Buffer.from(await r.arrayBuffer());
}
/** Gate F0 invertido: para una PALABRA queremos que el final BAJE. */
async function endsRising(mp3: string): Promise<{ rises: boolean; detail: string }> {
  const r = await spawnCap(F0_PYTHON, ["scripts/_f0gate.py", mp3, "question"]);
  if (r.code !== 0) return { rises: false, detail: "f0-skip" };
  try { const v = JSON.parse(r.out.trim()); return { rises: !!v.ok, detail: `slope ${v.slope} end ${v.end}` }; }
  catch { return { rises: false, detail: "f0-parse" }; }
}
async function renderWord(word: string, voice: string, apiKey: string, out: string, langCode: string) {
  for (let t = 1; t <= MAX_TRIES; t += 1) {
    try {
      await normalize(await tts(word, voice, apiKey, langCode), out);
      const f = await endsRising(out);
      if (!f.rises) return { ok: true, tries: t, detail: f.detail };
    } catch { /* reintenta */ }
  }
  return { ok: false, tries: MAX_TRIES, detail: "sigue subiendo tras reintentos" };
}

(async () => {
  const langArg = (process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1] ?? "german").toLowerCase();
  const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
  const dry = process.argv.includes("--dry");
  const langCode = LANG_CODES[langArg];
  if (!langCode) throw new Error(`idioma no soportado: ${langArg}`);
  const voice = LANG_DEFAULT_VOICE[langCode];
  if (!voice) throw new Error(`no hay voz aprobada para ${langArg}`);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey && !dry) throw new Error("falta ELEVENLABS_API_KEY");

  const favs = await prisma.favorite.findMany({
    where: { language: { equals: langArg, mode: "insensitive" } },
    select: { word: true },
  });
  // Fuera las que YA suenan por el clip pre-horneado del ejercicio
  // (audioClip.wordClipUrl): esas no pasan nunca por word-tts, y generarles
  // otro clip seria pagar dos veces por lo mismo.
  const exs = await prisma.storyPracticeExercise.findMany({ select: { word: true, payload: true } });
  const yaSuenan = new Set<string>();
  for (const e of exs) {
    const ac = (e.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
    if (e.word && typeof ac?.wordClipUrl === "string") yaSuenan.add(e.word.trim().toLowerCase());
  }
  const words = [...new Set(favs.map((f) => f.word.trim()).filter(Boolean))]
    .filter((w) => !yaSuenan.has(w.toLowerCase()));

  // Solo las que NO estan ya en la cache del endpoint.
  const pend: string[] = [];
  for (const w of words) {
    const url = getPublicObjectUrl(cacheKey(voice, w, langCode));
    if (!url) { pend.push(w); continue; }
    try { const h = await fetch(url, { method: "HEAD" }); if (!h.ok) pend.push(w); }
    catch { pend.push(w); }
  }
  const targets = limitArg > 0 ? pend.slice(0, limitArg) : pend;
  console.log(`${langArg}: ${words.length} palabras, ${pend.length} sin clip, se generan ${targets.length}`);
  console.log(`voz=${voice}  modelo=${WORD_MODEL}  gate F0=ON`);
  if (dry) { console.log("--dry: no se genera nada."); return; }

  const d = mkdtempSync(join(tmpdir(), "fwtout-"));
  let ok = 0, fail = 0;
  for (const [i, w] of targets.entries()) {
    const out = join(d, `${i}.mp3`);
    const r = await renderWord(w, voice, apiKey!, out, langCode);
    if (!r.ok) { console.log(`  ✗ ${w}  (${r.detail})`); fail += 1; continue; }
    const up = await uploadPublicObject({
      key: cacheKey(voice, w, langCode),
      body: readFileSync(out),
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (!up) { console.log(`  ✗ ${w}  (subida fallida)`); fail += 1; continue; }
    console.log(`  ✓ ${w}  intentos=${r.tries}  ${r.detail}`);
    ok += 1;
  }
  rmSync(d, { recursive: true, force: true });
  console.log(`\ngenerados ${ok}, fallidos ${fail}`);
})().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
