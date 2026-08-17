/**
 * THROWAWAY voice audition; renders candidate (UNAPPROVED) voices on real
 * sentences, LOCAL ONLY (no R2, no DB, no allowlist mutation). This is the
 * sanctioned way to audition a candidate by ear before the user approves it
 * (CLAUDE.md: "audition with FREE previews or a throwaway sample that does NOT
 * write to production"). It faithfully mirrors _genPracticeClips.ts's pipeline
 * (settings, 2-pass loudnorm, tail gate, F0 anti-uptalk gate, STT round-trip)
 * so the candidate is judged on the SAME bar as production; but it does NOT
 * import approvedVoices (that gate is production-only). References _f0gate.py
 * (guard 6e). Rendering is authorised only under the user's explicit audio verb.
 *
 * Run: npx tsx scripts/_auditionVoiceClips.ts --voice=<id> --label=<name>
 *   (sentences are the Friends Spain A0 trio below; edit SENTENCES to reuse)
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const voiceArg = process.argv.find((a) => a.startsWith("--voice="));
const labelArg = process.argv.find((a) => a.startsWith("--label="));
if (!voiceArg) throw new Error("usage: --voice=<id> [--label=<name>]");
const VOICE = voiceArg.slice(8);
const LABEL = labelArg ? labelArg.slice(8) : VOICE;

// Friends Spain A0 (peninsular); same 3 sentences used to audition Javier.
const SENTENCES: { word: string; sentence: string }[] = [
  { word: "bajar", sentence: "Lucía baja del tren en Madrid." },
  { word: "abrazar", sentence: "Las dos amigas se abrazan muy contentas." },
  { word: "llover", sentence: "De repente, empieza a llover." },
];

const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true };
const MAX_TRIES = 4;
// Spanish framing (statement context; the trio are declaratives).
const LANG = {
  prev: "Ahora escucha esta frase.", next: "Muy bien. Ahora sigamos con la siguiente.",
  prevQ: "Él tiene una duda y pregunta:", nextQ: "Ella le responde enseguida.",
  whisper: "es", scribe: "spa",
  wh: /(qué|quién|quiénes|cómo|cuándo|dónde|adónde|cuál|cuáles|cuánto|cuánta|cuántos|cuántas)/i,
};
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const WHISPER_MODEL = join(process.env.HOME || "", ".cache", "whisper", "ggml-base.bin");
const TAIL_MAX_DB = -20;

const isQuestion = (s: string) => s.trim().endsWith("?");
const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”„«»".,!?;:()¿¡'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0, 150)}`)))); });
}
function ffCapture(args: string[]): Promise<string> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", () => res(e)); });
}
function probe(f: string): Promise<number> {
  return new Promise((res) => { const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (c) => (o += c)); p.on("close", () => res(parseFloat(o.trim()) || 0)); });
}
function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}
async function tts(text: string, apiKey: string): Promise<Buffer> {
  const q = isQuestion(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
    method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, previous_text: q ? LANG.prevQ : LANG.prev, next_text: q ? LANG.nextQ : LANG.next, voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text()).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
async function measureLoudnorm(inPath: string): Promise<Record<string, string>> {
  const out = await ffCapture(["-i", inPath, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]);
  const m = out.slice(out.lastIndexOf("{"), out.lastIndexOf("}") + 1);
  try { return JSON.parse(m); } catch { return {}; }
}
async function normalise(raw: Buffer, outPath: string): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), "av-")); const i = join(dir, "i.mp3");
  try {
    writeFileSync(i, raw);
    const s = await measureLoudnorm(i);
    const linear = s.input_i && s.input_tp && s.input_lra && s.input_thresh
      ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:linear=true:print_format=summary`
      : `loudnorm=I=-16:TP=-1.5:LRA=11`;
    const trimEdges =
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak," +
      "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak,areverse";
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", `${trimEdges},${linear},apad=pad_dur=0.12`, "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
    return probe(outPath);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
let tailGateWarned = false;
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
    const toks = (json.transcription || []).flatMap((s: any) => s.tokens || []).filter((t: any) => (t.text || "").trim() && !t.text.startsWith("[_"));
    if (!toks.length) return { ok: false, db: 0 };
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
let f0GateWarned = false;
async function f0Ok(mp3Path: string, sentence: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const mode = isQuestion(sentence) && !LANG.wh.test(sentence) ? "question" : "statement";
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
function transcriptOk(sentence: string, tx: string): boolean {
  const wantList = strip(sentence).split(" ").filter((w) => w.length >= 3);
  const heardList = strip(tx).split(" ");
  const want = new Set(wantList); const heard = new Set(heardList);
  const heardJoined = heardList.join(""); const wantJoined = wantList.join("");
  const ed1 = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
    }
    return true;
  };
  const miss = wantList.filter((w) => !heard.has(w) && !heardJoined.includes(w) && !heardList.some((h) => w.length >= 4 && ed1(w, h)));
  const extra = heardList.filter((w) => w.length >= 4 && !want.has(w) && !wantJoined.includes(w) && !wantList.some((t) => t.length >= 4 && ed1(w, t)));
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
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");
  const outDir = join(process.cwd(), "public", "_practice-clips");
  mkdirSync(outDir, { recursive: true });
  const safe = VOICE.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  console.log(`audition (local-only): ${LABEL} ${VOICE}`);
  const rows: { word: string; sentence: string; file: string; ok: boolean; tries: number; dur: number }[] = [];
  let n = 0;
  for (const { word, sentence } of SENTENCES) {
    n++;
    const file = `audition-${safe}-${n}.mp3`;
    const res = await renderSentence(sentence, apiKey, join(outDir, file));
    console.log(`${n}: ${word} ${res.ok ? `✓ ${res.tries}t ${res.dur.toFixed(2)}s` : "✗ FAILED"}`);
    rows.push({ word, sentence, file, ...res });
  }
  const page = join(process.cwd(), "public", `_audition-${safe}.html`);
  const cards = rows.map((r, i) => `
    <div class="card">
      <div class="lbl">${i + 1}. ${r.word} ${r.ok ? `<span class="ok">${r.tries}t · ${r.dur.toFixed(2)}s</span>` : `<span class="bad">FAILED</span>`}</div>
      <div class="sen">${r.sentence}</div>
      <audio controls preload="none" src="/_practice-clips/${r.file}"></audio>
    </div>`).join("");
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><title>Audición; ${LABEL}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0a1220;color:#e7eef7;font:16px/1.5 system-ui,sans-serif;padding:28px 18px 60px}.wrap{max-width:640px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.sub{color:#93a4bd;font-size:13px;margin:0 0 22px}.card{background:#111c30;border:1px solid #22314a;border-radius:14px;padding:14px 16px;margin-bottom:14px}.lbl{font-weight:800;font-size:15px}.ok{color:#34d399;font-weight:700;font-size:12px;margin-left:6px}.bad{color:#f87171;font-weight:700;font-size:12px;margin-left:6px}.sen{color:#c7d3e3;font-size:14px;margin:4px 0 10px}audio{width:100%}</style>
<div class="wrap"><h1>Audición; ${LABEL}</h1><p class="sub">Candidata (no aprobada) · Friends España A0 · mismo pipeline que Javier (loudnorm + tail + F0 gate) · render local, no producción</p>${cards}</div>`);
  console.log(`\nPage: /_audition-${safe}.html`);
})();
