/**
 * Production sentence-clip pre-generation for curated practice sets.
 *
 * For each `meaning_in_context` and `fill_blank` exercise in
 * `scripts/_sets/<slug>.json` whose `audioClip.sentence` has no `clipUrl` yet,
 * render the FULL sentence (never a trimmed fragment) with ElevenLabs in the
 * fixed narrator voice, edge-normalise (no internal carving), upload to R2 and
 * write the resulting `clipUrl` back into the JSON. Re-seed afterwards.
 *
 * `listen_choose` is skipped (it replays a real story fragment via voiceId).
 * `match_meaning` is skipped (word audio is resolved at runtime by word-tts).
 *
 * Run: npx tsx scripts/_genPracticeClips.ts <slug> [--force] [--only=word1,word2]
 * `--only` re-renders just those words (comma-separated, accent-insensitive)
 * even if they already have a clipUrl. Re-renders bump `audioClip.rev`, which
 * is part of the R2 key hash: R2 serves `immutable`, so a re-render MUST get a
 * fresh URL or clients keep playing the old cached clip.
 *
 * Audition flow for re-renders (prosody can only be judged by ear):
 *   --takes=N   render N QA-passing candidates per word, LOCAL ONLY (no R2, no
 *               JSON write); writes a numbered audition page + manifest.
 *   --pick=n,n  publish exactly the takes the user chose by number (uploads,
 *               bumps rev, writes clipUrl). No TTS call, so not gated.
 * Rendering (--takes or default) is authorised only under the user's explicit
 * "genera audio" instruction.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const prisma = new PrismaClient();
// Voice is resolved per story (the story's narrator) — see practiceVoice.ts.
let VOICE = "";
// multilingual_v2, NOT turbo: turbo_v2_5 is deprecated to the low-latency tier
// with documented garbling; latency is irrelevant for pre-generated clips. v2
// does not accept language_code, but a full Spanish sentence auto-detects fine
// (isolated words do NOT — word-tts keeps turbo+language_code for that reason).
const MODEL = "eleven_multilingual_v2";
// (language_code intentionally not sent: v2 rejects it)
// Neutral spoken context on both sides: the documented remedy for the upspeak
// bias v2 shows on short isolated sentences (same fix elevenlabs.ts applies to
// narration via request stitching). Conditions prosody only; never rendered.
// Questions get QUESTION framing: the declarative context flattened the
// interrogative contour (user-reported 2026-07-02, confirmed by F0: the two
// question clips ended at +1.3/-0.1 st where a Spanish yes/no question rises).
// 2026-07-07: parametrizado por idioma (--lang=de para alemán). El framing,
// el modelo de whisper, el código de Scribe y el regex de W-Fragen dependen
// del idioma; español sigue siendo el default (sets LATAM intactos).
const LANGS: Record<string, { prev: string; next: string; prevQ: string; nextQ: string; whisper: string; scribe: string; wh: RegExp }> = {
  es: {
    prev: "Ahora escucha esta frase.",
    next: "Muy bien. Ahora sigamos con la siguiente.",
    prevQ: "Él tiene una duda y pregunta:",
    nextQ: "Ella le responde enseguida.",
    whisper: "es", scribe: "spa",
    wh: /(qué|quién|quiénes|cómo|cuándo|dónde|adónde|cuál|cuáles|cuánto|cuánta|cuántos|cuántas)/i,
  },
  de: {
    prev: "Hör dir diesen Satz an.",
    next: "Gut. Weiter zum nächsten Satz.",
    prevQ: "Er hat eine Frage und fragt:",
    nextQ: "Sie antwortet ihm sofort.",
    whisper: "de", scribe: "deu",
    // W-Fragen terminan cayendo por naturaleza (como las wh españolas);
    // solo las ja/nein-Fragen exigen subida final.
    wh: /(\bwer\b|\bwen\b|\bwem\b|\bwessen\b|\bwas\b|\bwie\b|\bwieso\b|\bweshalb\b|\bwarum\b|\bwann\b|\bwo\b|\bwohin\b|\bwoher\b|\bwelch)/i,
  },
};
// El idioma del framing (previous_text/next_text), del STT y de los gates se
// DERIVA de la historia (`journey.language`) en `resolveRenderLang`, NO de un
// flag suelto. `--lang` queda solo como override explícito y, si contradice el
// idioma real de la historia, ABORTA. WHY (2026-07-22): varios clips alemanes
// salieron con acento gringo porque se rendearon sin `--lang=de` → default
// "es" → previous_text/next_text en español alrededor de una frase alemana, y
// encima el STT corría en español y "validaba" el audio malo. Derivarlo de la
// DB hace ese error IMPOSIBLE. tts()/gates leen `LANG` en tiempo de llamada.
const langArg = process.argv.find((a) => a.startsWith("--lang="));
const JOURNEY_LANG_TO_KEY: Record<string, string> = {
  spanish: "es", german: "de", italian: "it", french: "fr", portuguese: "pt",
};
let LANG = LANGS[langArg ? langArg.slice(7) : "es"] ?? LANGS.es;
/** Fija LANG desde el idioma de la historia; aborta si no hay framing para ese
 *  idioma o si un `--lang` explícito lo contradice. Llamar SIEMPRE antes de
 *  renderizar (lo hace main tras cargar la historia). */
function resolveRenderLang(journeyLanguage: string | null | undefined): void {
  const norm = (journeyLanguage ?? "").trim().toLowerCase();
  const key = JOURNEY_LANG_TO_KEY[norm];
  if (!key) throw new Error(`[lang-guard] journey.language "${journeyLanguage}" no mapea a idioma soportado (${Object.keys(JOURNEY_LANG_TO_KEY).join(", ")})`);
  if (!LANGS[key]) throw new Error(`[lang-guard] falta framing/STT para "${key}" en LANGS; agrégalo antes de rendear ${norm}`);
  const flag = langArg ? langArg.slice(7) : null;
  if (flag && flag !== key) throw new Error(`[lang-guard] --lang=${flag} contradice el idioma real de la historia (${norm} → ${key}). Quita el flag o corrígelo.`);
  LANG = LANGS[key];
}
// Final intonation is what the F0 gate measures, so what matters is how the
// sentence ENDS: "Ella dice: ¿Tacos? ¡Son deliciosos!" contains a question
// but ends exclamative (falling) and must be gated as a statement.
const isQuestion = (s: string) => s.trim().endsWith("?");
// Match the NARRATION settings (elevenlabs.ts DEFAULT_VOICE_SETTINGS): the
// project already learned on 2026-06-10 that style 0 sounds flat/monotone; at
// style 0 the voice has no expressive range for a question's final rise
// (measured: narration question ends +11 st, style-0 clips max +1.3 st).
// style>0 can add extra sounds/dirty tails, but the STT + tail gates catch
// those now; do NOT "fix" artifacts by flattening style again.
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true };
const CLIP_VERSION = "v4"; // v2: dropped dynaudnorm; v3: multilingual_v2 + stitching + style 0; v4: narration settings (style .3)
const MAX_TRIES = 4;

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”„«»".,!?;:()¿¡'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function clipKey(sentence: string, rev: number): string {
  const hash = crypto.createHash("sha256").update(`${CLIP_VERSION}|${VOICE}|${sentence}${rev ? `|r${rev}` : ""}`).digest("hex").slice(0, 16);
  return `media/practice/sentence-clip/${hash}.mp3`;
}
function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0, 150)}`)))); });
}
function probe(f: string): Promise<number> {
  return new Promise((res) => { const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (c) => (o += c)); p.on("close", () => res(parseFloat(o.trim()) || 0)); });
}
async function tts(text: string, apiKey: string): Promise<Buffer> {
  assertVoiceApproved(VOICE, "practice-clip");
  const q = isQuestion(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text, model_id: MODEL,
      previous_text: q ? LANG.prevQ : LANG.prev,
      next_text: q ? LANG.nextQ : LANG.next,
      voice_settings: SETTINGS,
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text()).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
// Measure loudnorm stats (pass 1) so pass 2 can apply a CONSTANT (linear) gain.
// dynaudnorm is deliberately NOT used: its ~1s adaptive window ramped the volume
// up over the first second (audible "quiet start") and boosted the trailing
// breath. Two-pass loudnorm is constant-gain, so neither artifact happens.
function ffCapture(args: string[]): Promise<string> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", () => res(e)); });
}
async function measureLoudnorm(inPath: string): Promise<Record<string, string>> {
  const out = await ffCapture(["-i", inPath, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]);
  const m = out.slice(out.lastIndexOf("{"), out.lastIndexOf("}") + 1);
  try { return JSON.parse(m); } catch { return {}; }
}
// Full sentence, constant gain. Edge silence is trimmed at a conservative -50 dB
// (dead air only, never speech), then a uniform tiny pad is added on both ends.
async function normalise(raw: Buffer, outPath: string): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), "pc-")); const i = join(dir, "i.mp3");
  try {
    writeFileSync(i, raw);
    const s = await measureLoudnorm(i);
    const linear =
      s.input_i && s.input_tp && s.input_lra && s.input_thresh
        ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:linear=true:print_format=summary`
        : `loudnorm=I=-16:TP=-1.5:LRA=11`;
    const trimEdges =
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak," +
      "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak,areverse";
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", `${trimEdges},${linear},apad=pad_dur=0.12`, "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
    return probe(outPath);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
// ---- Tail-artifact gate ----------------------------------------------------
// v2 (and turbo) sometimes append voiced junk after the last word: babble,
// breath, vocal fry. No STT sees it (Scribe and whisper both transcribed the
// confirmed-bad clip as clean), so the check is geometric: where does the last
// transcribed token END vs is there loud audio after it. Threshold measured on
// 31 labeled mole clips: artifacts sat at -7.6 and -12.4 dB max-volume after
// the last token; every clean clip was ≤ -25.0 dB. -20 splits with margin.
// Uses local whisper.cpp (brew install whisper-cpp + ggml-base at
// ~/.cache/whisper/); if missing, the gate is skipped with a warning.
const WHISPER_MODEL = join(process.env.HOME || "", ".cache", "whisper", "ggml-base.bin");
const TAIL_MAX_DB = -20;
let tailGateWarned = false;
function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}
async function tailClean(mp3Path: string): Promise<{ ok: boolean; db: number | null }> {
  const dir = mkdtempSync(join(tmpdir(), "tail-"));
  try {
    const wav = join(dir, "a.wav");
    await ff(["-y", "-loglevel", "error", "-i", mp3Path, "-ar", "16000", "-ac", "1", wav]);
    let json: any;
    try {
      const r = await spawnCapture("whisper-cli", ["-m", WHISPER_MODEL, "-l", LANG.whisper, "-np", "-ojf", "-of", join(dir, "a"), wav]);
      if (r.code !== 0) throw new Error(r.err.slice(0, 120));
      json = JSON.parse(readFileSync(join(dir, "a.json"), "utf8"));
    } catch (err) {
      if (!tailGateWarned) { tailGateWarned = true; console.log(`WARN tail gate skipped (whisper-cli/model unavailable): ${(err as Error).message}`); }
      return { ok: true, db: null };
    }
    const toks = (json.transcription || []).flatMap((s: any) => s.tokens || [])
      .filter((t: any) => (t.text || "").trim() && !t.text.startsWith("[_"));
    if (!toks.length) return { ok: false, db: 0 }; // no speech recognized at all
    const lastMs: number = toks[toks.length - 1].offsets.to;
    const dur = await probe(mp3Path);
    const start = (lastMs + 60) / 1000;
    if (start >= dur) return { ok: true, db: null };
    const v = await spawnCapture("ffmpeg", ["-i", mp3Path, "-af", `atrim=start=${start},volumedetect`, "-f", "null", "-"]);
    const m = v.err.match(/max_volume:\s*(-?[\d.]+) dB/);
    const db = m ? parseFloat(m[1]) : null;
    return { ok: db === null || db <= TAIL_MAX_DB, db };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// ---- Intonation gate (F0) --------------------------------------------------
// Spanish yes/no questions differ from statements almost solely by a final F0
// rise; a flat question sounds like a statement. scripts/_f0gate.py (praat-
// parselmouth in the ~/.cache/dpl-qa venv) rejects questions whose final
// contour does not rise. Statements are warn-only there (pitch tracking on
// final creak octave-jumps, a hard uptalk gate would false-reject).
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
let f0GateWarned = false;
// Spanish wh-questions (¿quién/qué/cómo...?) end FALLING by nature: the
// interrogative word carries the question cue, not a final rise. Only yes/no
// questions require the rising-final gate. Accented forms only occur in
// interrogatives, so their presence identifies a wh-question reliably.
// Deliberative "¿Y si...?" questions also end falling in natural Spanish
// (Jhenny rendered one falling 8/8; the narration reads it the same way).
const DELIBERATIVE_QUESTION = /^\s*¿\s*y\s+si\b/i;
async function f0Ok(mp3Path: string, sentence: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const mode =
      isQuestion(sentence) && !LANG.wh.test(sentence) && !DELIBERATIVE_QUESTION.test(sentence)
        ? "question"
        : "statement";
    const r = await spawnCapture(F0_PYTHON, ["scripts/_f0gate.py", mp3Path, mode]);
    if (r.code !== 0) throw new Error(r.err.slice(0, 120));
    const v = JSON.parse(r.out.trim());
    if (v.reason && v.reason.includes("warn")) console.log(`   f0 warn: ${v.reason} (slope ${v.slope}, end ${v.end})`);
    return { ok: !!v.ok, detail: `${v.reason} (slope ${v.slope}, end ${v.end})` };
  } catch (err) {
    if (!f0GateWarned) { f0GateWarned = true; console.log(`WARN f0 gate skipped (venv/parselmouth unavailable): ${(err as Error).message}`); }
    return { ok: true, detail: "skipped" };
  }
}

async function sttText(buf: Buffer, apiKey: string): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", LANG.scribe);
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return ((await res.json()) as { text?: string }).text || "";
}

// QA both directions: every content word of the sentence must appear in the
// transcription (a miss = garbled/dropped word), and the transcription must
// not contain content words absent from the sentence (an extra = hallucinated
// word — the "gracias" appended to the mole clip passed the old miss-only
// check). Scribe is accurate on short clean sentences, so slack is minimal.
function transcriptOk(sentence: string, tx: string): boolean {
  const wantList = strip(sentence).split(" ").filter((w) => w.length >= 3);
  const heardList = strip(tx).split(" ");
  const want = new Set(wantList);
  const heard = new Set(heardList);
  // Tolerancias DE (2026-07-08), simétricas:
  // 1) compuestos separados por el STT ("dabeihaben" -> "dabei haben"):
  //    ni miss (la palabra está en el transcript sin espacios) ni extra
  //    (los fragmentos están en la oración sin espacios).
  // 2) nombres/grafías a distancia de edición 1 ("Nadia" -> "Nadja").
  const heardJoined = heardList.join("");
  const wantJoined = wantList.join("");
  const ed1 = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        return (
          a.slice(i + 1) === b.slice(i + 1) || // sustitución
          a.slice(i + 1) === b.slice(i) ||     // borrado en a
          a.slice(i) === b.slice(i + 1)        // borrado en b
        );
      }
    }
    return true; // difieren solo en el último char extra
  };
  const miss = wantList.filter(
    (w) => !heard.has(w) && !heardJoined.includes(w) && !heardList.some((h) => w.length >= 4 && ed1(w, h))
  );
  const extra = heardList.filter(
    (w) => w.length >= 4 && !want.has(w) && !wantJoined.includes(w) && !wantList.some((t) => t.length >= 4 && ed1(w, t))
  );
  const missAllowed = wantList.length > 8 ? 1 : 0;
  return miss.length <= missAllowed && extra.length === 0;
}

async function renderSentence(sentence: string, apiKey: string, outPath: string): Promise<{ ok: boolean; dur: number; tries: number }> {
  for (let t = 1; t <= MAX_TRIES; t++) {
    try {
      const raw = await tts(sentence, apiKey);
      const dur = await normalise(raw, outPath);
      const tx = await sttText(readFileSync(outPath), apiKey);
      if (!transcriptOk(sentence, tx) || dur < 0.6) continue;
      const tail = await tailClean(outPath);
      if (!tail.ok) { console.log(`   tail reject (${tail.db} dB) try ${t}`); continue; }
      const f0 = await f0Ok(outPath, sentence);
      if (!f0.ok) { console.log(`   f0 reject: ${f0.detail} try ${t}`); continue; }
      return { ok: true, dur, tries: t };
    } catch { /* retry */ }
  }
  return { ok: false, dur: 0, tries: MAX_TRIES };
}

(async () => {
  const slug = process.argv[2];
  const force = process.argv.includes("--force");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((w) => strip(w))) : null;
  const takesArg = process.argv.find((a) => a.startsWith("--takes="));
  const takes = takesArg ? Math.max(1, parseInt(takesArg.slice(8), 10) || 1) : 1;
  const pickArg = process.argv.find((a) => a.startsWith("--pick="));
  // Voice override for AUDITION renders (e.g. testing a candidate voice before
  // committing a swap). Only honored together with --takes (local-only), so an
  // off-voice clip can never be published/seeded by accident.
  const voiceArg = process.argv.find((a) => a.startsWith("--voice="));
  if (!slug) throw new Error("usage: _genPracticeClips.ts <slug> [--force] [--only=w1,w2] [--takes=N | --pick=n1,n2]");
  // Calibration/debug: run the tail gate on one file and exit.
  if (slug === "--tailcheck") { console.log(JSON.stringify(await tailClean(process.argv[3]))); return; }

  // RULE: practice clips use the story's own narrator voice (country-matched),
  // unless the story carries a practiceVoiceId override (practiceVoice.ts).
  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { voiceId: true, practiceVoiceId: true, journey: { select: { language: true } } },
  });
  if (!story) throw new Error(`story not found: ${slug}`);
  // Idioma DERIVADO de la historia (no del flag). Aborta si --lang lo contradice.
  resolveRenderLang(story.journey?.language);
  VOICE = practiceVoiceId(story);
  if (voiceArg) {
    if (!takesArg) throw new Error("--voice only works with --takes (audition renders are local-only)");
    VOICE = voiceArg.slice(8);
    console.log(`voice OVERRIDE (audition only): ${VOICE}`);
  }

  const path = `scripts/_sets/${slug}.json`;
  const exs: any[] = JSON.parse(readFileSync(path, "utf8"));
  const outDir = join(process.cwd(), "public", `_practice-clips`);
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(process.cwd(), "public", `_practice-clips-${slug}-takes.json`);

  // ---- pick mode: publish the user-chosen takes (no TTS call, not gated) ----
  if (pickArg) {
    const picks = pickArg.slice(7).split(",").map((x) => parseInt(x.trim(), 10));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.voice !== VOICE) throw new Error(`manifest voice ${manifest.voice} != story voice ${VOICE}`);
    const byWord = new Map<string, any>();
    for (const n of picks) {
      const it = manifest.items.find((i: any) => i.n === n);
      if (!it) throw new Error(`pick ${n} not in manifest`);
      if (!it.ok) throw new Error(`pick ${n} (${it.word} take ${it.take}) FAILED QA, not publishable`);
      if (byWord.has(strip(it.word))) throw new Error(`two picks for "${it.word}"`);
      byWord.set(strip(it.word), it);
    }
    for (const e of exs) {
      if (!e.payload?.audioClip?.sentence || !e.word) continue;
      const it = byWord.get(strip(e.word));
      if (!it) continue;
      // Re-render of an existing clip → bump rev so the R2 key (and URL) change.
      if (e.payload.audioClip.clipUrl) e.payload.audioClip.rev = (e.payload.audioClip.rev || 0) + 1;
      const key = clipKey(e.payload.audioClip.sentence, e.payload.audioClip.rev || 0);
      const body = readFileSync(join(outDir, it.file));
      await uploadPublicObject({ key, body, contentType: "audio/mpeg" });
      e.payload.audioClip.clipUrl = getPublicObjectUrl(key);
      // Keep the canonical local mp3 in sync so the full audition page plays the chosen take.
      writeFileSync(join(outDir, `${slug}__${strip(e.word).replace(/\s+/g, "-")}.mp3`), body);
      console.log(`${it.n}: ${e.word} (take ${it.take}) → ${e.payload.audioClip.clipUrl}`);
      byWord.delete(strip(e.word));
    }
    if (byWord.size) throw new Error(`words not found in set: ${[...byWord.keys()].join(", ")}`);
    writeFileSync(path, JSON.stringify(exs, null, 2) + "\n");
    console.log(`JSON updated: ${path}\nNow re-seed: npx tsx scripts/_seedAllSets.ts --only=${slug} --apply`);
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");
  console.log(`voice (story narrator): ${VOICE}`);

  const targets = exs
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (e.type === "meaning_in_context" || e.type === "fill_blank") && e.payload?.audioClip?.sentence)
    .filter(({ e }) => (only ? only.has(strip(e.word)) : force || !e.payload.audioClip.clipUrl));
  if (only && targets.length !== only.size)
    console.log(`WARN --only matched ${targets.length}/${only.size} words`);

  console.log(`${slug}: ${targets.length} sentence-clip(s) to render${force ? " (force)" : ""}${takes > 1 ? ` × ${takes} takes` : ""}`);

  // ---- multi-take audition mode: render candidates only. Nothing is uploaded
  // to R2 and the set JSON is untouched; the user picks by number and a second
  // run with --pick publishes only the approved takes. Any --takes value
  // (including 1) stays local-only; --voice requires this path. ----
  if (takesArg) {
    const items: Array<{ n: number; word: string; take: number; ok: boolean; tries: number; dur: number; file: string; sentence: string }> = [];
    let n = 1;
    for (const { e } of targets) {
      const sentence: string = e.payload.audioClip.sentence;
      for (let k = 1; k <= takes; k++) {
        const file = `${slug}__${strip(e.word).replace(/\s+/g, "-")}__t${k}.mp3`;
        const res = await renderSentence(sentence, apiKey, join(outDir, file));
        console.log(`${n}: ${e.word} take ${k} ${res.ok ? `✓ ${res.tries}t ${res.dur.toFixed(2)}s` : "✗ FAILED"}`);
        items.push({ n, word: e.word, take: k, ok: res.ok, tries: res.tries, dur: res.dur, file, sentence });
        n++;
      }
    }
    // MERGE (2026-07-07): conserva los takes previos de OTRAS palabras para
    // poder iterar palabras sueltas sin perder candidatos ya renderizados.
    // Los takes nuevos de la MISMA palabra reemplazan a los suyos anteriores.
    let mergedItems = items;
    try {
      const prev = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (prev?.voice === VOICE && Array.isArray(prev.items)) {
        const renderedWords = new Set(items.map((i: any) => strip(i.word)));
        const kept = prev.items.filter((i: any) => !renderedWords.has(strip(i.word)));
        mergedItems = [...kept, ...items].map((it: any, idx: number) => ({ ...it, n: idx + 1 }));
      }
    } catch { /* primer run: no hay manifest previo */ }
    writeFileSync(manifestPath, JSON.stringify({ voice: VOICE, items: mergedItems }, null, 2) + "\n");
    const takeOpts = mergedItems.map((d: any) => `
    <div class="opt ${d.ok ? "" : "bad"}"><div class="num">${d.n}</div>
      <div class="body"><div class="lbl">${d.word} — take ${d.take} <span>${d.ok ? `${d.tries}t · ${d.dur.toFixed(2)}s` : "FAILED"}</span></div>
      <div class="sen">${d.sentence}</div>
      ${d.ok ? `<audio controls preload="none" src="/_practice-clips/${d.file}"></audio>` : ""}</div></div>`).join("");
    const takesHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Takes — ${slug}</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.opt.bad{background:rgba(251,113,133,.12)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:11px;margin-left:6px}
.sen{color:#c7d3e6;font-size:13px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>Takes candidatos — ${slug}</h1>
<p class="sub">NADA publicado aún (ni R2 ni DB). Dime un número por palabra y publico solo esos.</p>
${takeOpts}</body></html>`;
    writeFileSync(join(process.cwd(), "public", `_practice-clips-${slug}-takes.html`), takesHtml);
    console.log(`\nManifest: ${manifestPath}\nPage: /_practice-clips-${slug}-takes.html`);
    return;
  }

  const done: Array<{ n: number; word: string; ok: boolean; tries: number; dur: number; file: string; sentence: string }> = [];
  let n = 1;
  for (const { e } of targets) {
    const sentence: string = e.payload.audioClip.sentence;
    const file = `${slug}__${strip(e.word).replace(/\s+/g, "-")}.mp3`;
    const outPath = join(outDir, file);
    const res = await renderSentence(sentence, apiKey, outPath);
    if (res.ok) {
      // Re-render of an existing clip → bump rev so the R2 key (and URL) change.
      if (e.payload.audioClip.clipUrl) e.payload.audioClip.rev = (e.payload.audioClip.rev || 0) + 1;
      const key = clipKey(sentence, e.payload.audioClip.rev || 0);
      await uploadPublicObject({ key, body: readFileSync(outPath), contentType: "audio/mpeg" });
      e.payload.audioClip.clipUrl = getPublicObjectUrl(key);
    }
    console.log(`${n}: ${e.word} [${e.type}] ${res.ok ? `✓ ${res.tries}t ${res.dur.toFixed(2)}s → ${e.payload.audioClip.clipUrl}` : "✗ FAILED"}`);
    done.push({ n, word: e.word, ok: res.ok, tries: res.tries, dur: res.dur, file, sentence });
    n++;
  }

  writeFileSync(path, JSON.stringify(exs, null, 2) + "\n");
  console.log(`\n${done.filter((d) => d.ok).length}/${done.length} clips ok. JSON updated: ${path}`);

  // Audition page for the user to listen locally.
  const opts = done.map((d) => `
    <div class="opt ${d.ok ? "" : "bad"}"><div class="num">${d.n}</div>
      <div class="body"><div class="lbl">${d.word} <span>${d.ok ? `${d.tries}t · ${d.dur.toFixed(2)}s` : "FAILED"}</span></div>
      <div class="sen">${d.sentence}</div>
      ${d.ok ? `<audio controls preload="none" src="/_practice-clips/${d.file}"></audio>` : ""}</div></div>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Clips — ${slug}</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.opt.bad{background:rgba(251,113,133,.12)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:11px;margin-left:6px}
.sen{color:#c7d3e6;font-size:13px;margin:4px 0}audio{width:100%;margin-top:6px}</style></head><body>
<h1>Sentence-clips — ${slug} (voz Narrador2, oración completa)</h1>
<p class="sub">Ya cacheados en R2 y escritos al JSON. Dime el número de cualquiera que suene mal y lo regenero.</p>
${opts}</body></html>`;
  // --only runs write a separate page so the full-set audition page survives.
  const pageName = `_practice-clips-${slug}${only ? "-regen" : ""}.html`;
  writeFileSync(join(process.cwd(), "public", pageName), html);
  console.log(`Page: /${pageName}`);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
