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
 * Run: npx tsx scripts/_genPracticeClips.ts <slug> [--force]
 * Authorised only under the user's explicit "genera audio" instruction.
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

const prisma = new PrismaClient();
// Voice is resolved per story (the story's narrator) — see practiceVoice.ts.
let VOICE = "";
const MODEL = "eleven_turbo_v2_5";
const LANG = "es";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 0.9, use_speaker_boost: true };
const CLIP_VERSION = "v2"; // v2: dropped dynaudnorm (start-volume ramp + tail breath)
const MAX_TRIES = 4;

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”„«»".,!?;:()¿¡'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function clipKey(sentence: string): string {
  const hash = crypto.createHash("sha256").update(`${CLIP_VERSION}|${VOICE}|${sentence}`).digest("hex").slice(0, 16);
  return `media/practice/sentence-clip/${hash}.mp3`;
}
function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0, 150)}`)))); });
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
async function sttText(buf: Buffer, apiKey: string): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!res.ok) throw new Error(`STT ${res.status}`);
  return ((await res.json()) as { text?: string }).text || "";
}

// QA: every content word of the sentence must appear in the transcription
// (light check — full-sentence STT is reliable enough for presence).
function transcriptOk(sentence: string, tx: string): boolean {
  const heard = new Set(strip(tx).split(" "));
  const want = strip(sentence).split(" ").filter((w) => w.length >= 3);
  const miss = want.filter((w) => !heard.has(w));
  return miss.length <= Math.floor(want.length * 0.15); // ≤15% slack for elisions
}

async function renderSentence(sentence: string, apiKey: string, outPath: string): Promise<{ ok: boolean; dur: number; tries: number }> {
  for (let t = 1; t <= MAX_TRIES; t++) {
    try {
      const raw = await tts(sentence, apiKey);
      const dur = await normalise(raw, outPath);
      const tx = await sttText(readFileSync(outPath), apiKey);
      if (transcriptOk(sentence, tx) && dur >= 0.6) return { ok: true, dur, tries: t };
    } catch { /* retry */ }
  }
  return { ok: false, dur: 0, tries: MAX_TRIES };
}

(async () => {
  const slug = process.argv[2];
  const force = process.argv.includes("--force");
  if (!slug) throw new Error("usage: _genPracticeClips.ts <slug> [--force]");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  // RULE: practice clips use the story's own narrator voice (country-matched).
  const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { voiceId: true } });
  if (!story) throw new Error(`story not found: ${slug}`);
  VOICE = practiceVoiceId(story.voiceId);
  console.log(`voice (story narrator): ${VOICE}`);

  const path = `scripts/_sets/${slug}.json`;
  const exs: any[] = JSON.parse(readFileSync(path, "utf8"));
  const outDir = join(process.cwd(), "public", `_practice-clips`);
  mkdirSync(outDir, { recursive: true });

  const targets = exs
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (e.type === "meaning_in_context" || e.type === "fill_blank") && e.payload?.audioClip?.sentence)
    .filter(({ e }) => force || !e.payload.audioClip.clipUrl);

  console.log(`${slug}: ${targets.length} sentence-clip(s) to render${force ? " (force)" : ""}`);
  const done: Array<{ n: number; word: string; ok: boolean; tries: number; dur: number; file: string; sentence: string }> = [];
  let n = 1;
  for (const { e } of targets) {
    const sentence: string = e.payload.audioClip.sentence;
    const file = `${slug}__${strip(e.word).replace(/\s+/g, "-")}.mp3`;
    const outPath = join(outDir, file);
    const res = await renderSentence(sentence, apiKey, outPath);
    if (res.ok) {
      const key = clipKey(sentence);
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
  writeFileSync(join(process.cwd(), "public", `_practice-clips-${slug}.html`), html);
  console.log(`Page: /_practice-clips-${slug}.html`);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
