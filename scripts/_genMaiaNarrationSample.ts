/**
 * THROWAWAY narration audition; renders a continuous story passage with a
 * candidate narrator voice, LOCAL ONLY (no R2/DB), to judge it for STORY
 * narration before the user approves it for that use. Mirrors the canonical
 * _genNarratorSample.ts (single continuous TTS call, DEFAULT_VOICE_SETTINGS,
 * eleven_multilingual_v2) plus a 2-pass loudnorm to -16 LUFS so it's judged at
 * the production loudness. Narrator prose only (dialogue would use character
 * voices in production). Rendering authorised only under the user's audio verb.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VOICE = "jipeLrCHZ6ByxrU2JP9i"; // Maia; Sweet Natural Storyteller (ES peninsular)
const LABEL = "Maia; narración";
// Narrator prose from "Marta enseña el Retiro" (Friends ES Spain A0).
const PASSAGE =
  "Marta lleva a Lucía al parque del Retiro. Hay árboles altos y mucha gente. " +
  "El sol brilla sobre el agua del lago. Lucía mira todo con ojos grandes. " +
  "Las amigas suben a una barca pequeña. Lucía rema y Marta canta una canción. " +
  "El agua está fría y muy limpia. Un pato nada cerca de ellas. " +
  "Después, las dos comen un helado de fresa. Lucía saca una foto bonita del lago. " +
  "Marta abraza a su amiga otra vez.";

const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 0.9, use_speaker_boost: true };
const MAX_TRIES = 4;
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const soften = (t: string) => t.replace(/!+/g, ".").replace(/\.{2,}/g, ".");

// QA-gate de entonación (_f0gate): mide el tono FINAL del pasaje y re-tira si el
// cierre sube (uptalk / "suena a pregunta"). El pasaje termina en afirmación,
// así que el modo es "statement". Mismo gate que _genPracticeClips.ts.
function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}
let f0GateWarned = false;
async function f0Ok(mp3Path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await spawnCapture(F0_PYTHON, ["scripts/_f0gate.py", mp3Path, "statement"]);
    if (r.code !== 0) throw new Error(r.err.slice(0, 120));
    const v = JSON.parse(r.out.trim());
    if (v.reason && String(v.reason).includes("warn")) console.log(`   f0 warn: ${v.reason} (slope ${v.slope}, end ${v.end})`);
    return { ok: !!v.ok, detail: `${v.reason} (slope ${v.slope}, end ${v.end})` };
  } catch (err) {
    if (!f0GateWarned) { f0GateWarned = true; console.log(`WARN f0 gate skipped (venv/parselmouth unavailable): ${(err as Error).message}`); }
    return { ok: true, detail: "skipped" };
  }
}

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}: ${e.slice(0, 150)}`)))); });
}
function ffCapture(args: string[]): Promise<string> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", () => res(e)); });
}
async function normalise(raw: Buffer, outPath: string): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "ns-")); const i = join(dir, "i.mp3");
  try {
    writeFileSync(i, raw);
    const stats = await ffCapture(["-i", i, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]);
    const m = stats.slice(stats.lastIndexOf("{"), stats.lastIndexOf("}") + 1);
    let s: Record<string, string> = {}; try { s = JSON.parse(m); } catch { /* */ }
    const linear = s.input_i && s.input_tp && s.input_lra && s.input_thresh
      ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:linear=true:print_format=summary`
      : `loudnorm=I=-16:TP=-1.5:LRA=11`;
    const trimEdges =
      "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak," +
      "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak,areverse";
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", `${trimEdges},${linear},apad=pad_dur=0.15`, "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

(async () => {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) throw new Error("ELEVENLABS_API_KEY missing");
  const outDir = join(process.cwd(), "public", "_practice-clips");
  mkdirSync(outDir, { recursive: true });
  const text = soften(PASSAGE);
  const file = "narration-maia-retiro.mp3";
  const outPath = join(outDir, file);
  let ok = false;
  for (let t = 1; t <= MAX_TRIES; t++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST", headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: SETTINGS }),
    });
    if (!r.ok) { console.log("FAIL", r.status, (await r.text()).slice(0, 150)); return; }
    const raw = Buffer.from(await r.arrayBuffer());
    await normalise(raw, outPath);
    const f0 = await f0Ok(outPath);
    if (f0.ok) { console.log(`✓ narration take ${t} (${raw.length} bytes) f0: ${f0.detail}`); ok = true; break; }
    console.log(`   f0 reject: ${f0.detail} try ${t}`);
  }
  if (!ok) { console.log("✗ FAILED f0 gate after retries"); return; }
  const page = join(process.cwd(), "public", "_narration-maia.html");
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><title>Narración; ${LABEL}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0a1220;color:#e7eef7;font:16px/1.6 system-ui,sans-serif;padding:28px 18px 60px}.wrap{max-width:640px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.sub{color:#93a4bd;font-size:13px;margin:0 0 22px}.card{background:#111c30;border:1px solid #22314a;border-radius:14px;padding:16px 18px}.sen{color:#c7d3e3;font-size:14px;margin:0 0 12px}audio{width:100%}</style>
<div class="wrap"><h1>Narración; ${LABEL}</h1><p class="sub">Candidata para NARRACIÓN (no aprobada aún) · "Marta enseña el Retiro" · Friends España A0 · settings de narración + loudnorm −16 LUFS · render local, no producción</p><div class="card"><div class="sen">${PASSAGE}</div><audio controls preload="none" src="/_practice-clips/${file}"></audio></div></div>`);
  console.log(`ok narration sample → /_narration-maia.html`);
})();
