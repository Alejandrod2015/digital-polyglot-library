/**
 * Production word-audio pre-generation. For each meaning word with an audioClip
 * in a story, render the isolated word with turbo_v2_5 + es in the fixed
 * narrator voice, validate with Scribe STT, and upload to the SAME R2 cache key
 * the /api/practice/word-tts endpoint reads (so the play button is instant and
 * never has to generate at runtime). Infinitives (final-stress, which lone-word
 * TTS tends to mis-stress) are rendered via a carrier sentence and trimmed using
 * Scribe word timestamps; everything else is rendered directly.
 *
 * Run: npx tsx scripts/_genJourneyWords.ts [slug]   (default la-promesa-del-mole)
 * Authorised by the user's explicit "genera" instruction.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { practiceVoiceId } from "../src/lib/practiceVoice";

const prisma = new PrismaClient();
const CACHE_VERSION = "v3"; // v3: dropped dynaudnorm — must match word-tts route
// Voice is resolved per story (the story's narrator) — see practiceVoice.ts.
// Must match what the practice page requests at runtime for the same story.
let VOICE = "";
const MODEL = "eleven_turbo_v2_5";
const LANG = "es";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 0.95, use_speaker_boost: true };
const MAX_TRIES = 8;

function strip(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”„«»".,!?;:()¿¡'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
function isInfinitive(w: string): boolean {
  return /(?:ar|er|ir)$/i.test(w) && w.length >= 4;
}
function cacheKey(word: string): string {
  const hash = crypto.createHash("sha256").update(`${CACHE_VERSION}|${VOICE}|${word.toLowerCase()}`).digest("hex").slice(0, 24);
  return `media/practice/word-tts/${hash}.mp3`;
}
function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0,150)}`)))); });
}
function probe(f: string): Promise<number> {
  return new Promise((res) => { const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (c) => (o += c)); p.on("close", () => res(parseFloat(o.trim()) || 0)); });
}
async function tts(text: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, language_code: LANG, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text()).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
async function loudnorm(raw: Buffer, outPath: string, pad: boolean): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), "jw-")); const i = join(dir, "i.mp3");
  try {
    writeFileSync(i, raw);
    const tail = pad ? "apad=pad_dur=0.15" : "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB:detection=peak,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB:detection=peak,areverse";
    // No dynaudnorm: its ~1s adaptive window ramped the volume up over the clip
    // start. Plain loudnorm is constant-enough for these sub-second words.
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", `loudnorm=I=-16:LRA=11:TP=-1.5,${tail}`, "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
    return probe(outPath);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
async function sttText(buf: Buffer, apiKey: string): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "w.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return ((await res.json()) as { text?: string }).text || "";
}
async function scribeWords(buf: Buffer, apiKey: string): Promise<Array<{ text: string; start: number; end: number }>> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa"); fd.append("timestamps_granularity", "word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "c.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return (((await res.json()) as any).words || []).filter((w: any) => w.text?.trim()).map((w: any) => ({ text: w.text, start: w.start, end: w.end }));
}

// Homophone-tolerant comparison for word QA: Scribe cannot distinguish LATAM
// homophones (vez/ves, haber/a ver, vaca/baca), so exact spelling match makes
// monosyllables fail forever. Compare by phonetic key (seseo + b/v + h + ll/y).
function phoneticKey(s: string): string {
  return strip(s)
    .replace(/z/g, "s").replace(/v/g, "b").replace(/h/g, "")
    .replace(/ll/g, "y").replace(/c([ei])/g, "s$1").replace(/qu/g, "k").replace(/c([aou])/g, "k$1");
}

// Returns {ok, finalBuf, dur, method, tries}
async function renderWord(word: string, apiKey: string, outDir: string): Promise<{ ok: boolean; file: string; dur: number; method: string; tries: number }> {
  const target = strip(word);
  const finalPath = join(outDir, `${word}.mp3`);
  // Ultra-short words (<=4 letters, single syllable-ish) render too short for
  // the direct QA window and Scribe misreads them in isolation; the carrier
  // sentence gives them natural context and Scribe word-timings cut them out.
  if (isInfinitive(word) || strip(word).replace(/[^a-z]/g, "").length <= 4) {
    // Carrier: natural final stress, then trim the last word via Scribe timings.
    const carrier = `La palabra es ${word}.`;
    for (let t = 1; t <= MAX_TRIES; t++) {
      try {
        const raw = await tts(carrier, apiKey);
        const cPath = join(outDir, "_c.mp3");
        await loudnorm(raw, cPath, false); // no trim: keep timeline for Scribe
        const words = await scribeWords(readFileSync(cPath), apiKey);
        const hit = [...words].reverse().find((w) => phoneticKey(w.text) === phoneticKey(target));
        if (!hit) { rmSync(cPath, { force: true }); continue; }
        const s = Math.max(0, hit.start - 0.04), e = hit.end + 0.08;
        await ff(["-y", "-loglevel", "error", "-i", cPath, "-ss", s.toFixed(3), "-to", e.toFixed(3), "-af", "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.12", "-codec:a", "libmp3lame", "-b:a", "128k", finalPath]);
        rmSync(cPath, { force: true });
        const dur = await probe(finalPath);
        // Ultra-short words: the isolated cut is unverifiable by STT (Scribe
        // hears "pie" as "bien"); the carrier pass already verified the word
        // in context with exact timestamps, so duration bounds suffice.
        const shortWord = strip(word).replace(/[^a-z]/g, "").length <= 4;
        const tx = shortWord ? target : strip(await sttText(readFileSync(finalPath), apiKey));
        if (phoneticKey(tx) === phoneticKey(target) && dur >= 0.3 && dur <= 1.6) return { ok: true, file: `${word}.mp3`, dur, method: "carrier", tries: t };
      } catch { /* retry */ }
    }
    return { ok: false, file: `${word}.mp3`, dur: 0, method: "carrier", tries: MAX_TRIES };
  }
  // Direct + QA loop.
  for (let t = 1; t <= MAX_TRIES; t++) {
    try {
      const raw = await tts(`${word}.`, apiKey);
      const sttPath = join(outDir, "_s.mp3");
      const dur = await loudnorm(raw, sttPath, false);
      const tx = strip(await sttText(readFileSync(sttPath), apiKey));
      rmSync(sttPath, { force: true });
      if (phoneticKey(tx) === phoneticKey(target) && dur >= 0.3 && dur <= 1.4) { await loudnorm(raw, finalPath, true); return { ok: true, file: `${word}.mp3`, dur, method: "direct", tries: t }; }
    } catch { /* retry */ }
  }
  return { ok: false, file: `${word}.mp3`, dur: 0, method: "direct", tries: MAX_TRIES };
}

(async () => {
  const slug = process.argv[2] || "la-promesa-del-mole";
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, voiceId: true, practiceVoiceId: true } });
  if (!story) throw new Error(`story not found: ${slug}`);
  VOICE = practiceVoiceId(story); // RULE: narrator voice, or practiceVoiceId override
  console.log(`voice (story narrator): ${VOICE}`);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DISTINCT e.word FROM dp_story_practice_exercises_v1 e JOIN dp_story_practice_sets_v1 s ON s.id=e."setId"
     WHERE s."storyId"=$1 AND e.type='meaning_in_context' AND e.payload->'audioClip'->>'sentence' IS NOT NULL ORDER BY e.word`, story.id);

  const outDir = join(process.cwd(), "public", "_word-audition");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const done: Array<{ n: number; word: string; ok: boolean; method: string; tries: number; dur: number; file: string }> = [];

  let n = 1;
  for (const r of rows) {
    const word = r.word as string;
    const res = await renderWord(word, apiKey, outDir);
    if (res.ok) {
      const buf = readFileSync(join(outDir, res.file));
      await uploadPublicObject({ key: cacheKey(word), body: buf, contentType: "audio/mpeg" });
    }
    console.log(`${n}: ${word} [${res.method}] ${res.ok ? `✓ ${res.tries}t ${res.dur.toFixed(2)}s → cached` : "✗ FAILED"}`);
    done.push({ n, word, ok: res.ok, method: res.method, tries: res.tries, dur: res.dur, file: res.file });
    n++;
  }

  const opts = done.map((d) => `
    <div class="opt ${d.ok ? "" : "bad"}">
      <div class="num">${d.n}</div>
      <div class="body"><div class="lbl">${d.word} <span>${d.method}${d.ok ? ` · ${d.tries}t · ${d.dur.toFixed(2)}s` : " · FAILED"}</span></div>
      ${d.ok ? `<audio controls preload="none" src="/_word-audition/${d.file}"></audio>` : ""}</div></div>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>Palabras — ${slug}</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:center;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(52,211,153,.07)}
.opt.bad{background:rgba(251,113,133,.12)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:11px;margin-left:6px}audio{width:100%;margin-top:8px}
.tip{color:#8ea0bd;font-size:13px;margin-top:16px}</style></head><body>
<h1>Palabras finales — ${slug} (voz Narrador2, turbo+es)</h1>
<p class="sub">Ya cacheadas en producción. Valida: dime el número de cualquiera que suene mal y la regenero.</p>
${opts}<p class="tip">Responde con números solo si algo está mal.</p></body></html>`;
  writeFileSync(join(process.cwd(), "public", "_word-audition.html"), html);
  console.log(`\n${done.filter((d) => d.ok).length}/${done.length} cached. Page: /_word-audition.html`);
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
