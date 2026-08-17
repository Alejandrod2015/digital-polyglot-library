/**
 * 5 direct takes of "avisar" (turbo+es, Narrador2, citation pace) for the user
 * to pick the one that sounds like the approved #1. Saved numbered, NOT cached
 * until chosen. Authorised by the user's explicit "genera" instruction.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VOICE = "yHD4CsKkghm19ToGLJEC";
const MODEL = "eleven_turbo_v2_5";
const SETTINGS = { stability: 0.5, similarity_boost: 0.8, style: 0.25, speed: 0.95, use_speaker_boost: true };
const WORD = "avisar";
const TAKES = 5;

function strip(s: string): string { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”„«»".,!?;:()¿¡'`]/g, "").replace(/\s+/g, " ").trim().toLowerCase(); }
function ff(a: string[]): Promise<void> { return new Promise((res, rej) => { const p = spawn("ffmpeg", a); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))); }); }
function probe(f: string): Promise<number> { return new Promise((res) => { const p = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]); let o = ""; p.stdout.on("data", (c) => (o += c)); p.on("close", () => res(parseFloat(o.trim()) || 0)); }); }
async function norm(raw: Buffer, out: string): Promise<number> { const d = mkdtempSync(join(tmpdir(), "at-")); const i = join(d, "i.mp3"); try { writeFileSync(i, raw); await ff(["-y", "-loglevel", "error", "-i", i, "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15", "-codec:a", "libmp3lame", "-b:a", "128k", out]); return probe(out); } finally { rmSync(d, { recursive: true, force: true }); } }
async function stt(buf: Buffer, k: string): Promise<string> { const fd = new FormData(); fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa"); fd.append("file", new Blob([new Uint8Array(buf)], { type: "audio/mpeg" }), "w.mp3"); const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": k }, body: fd }); if (!r.ok) throw new Error(`STT ${r.status}`); return ((await r.json()) as any).text || ""; }

(async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const outDir = join(process.cwd(), "public", "_word-audition");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const target = strip(WORD);
  const takes: Array<{ n: number; dur: number; tx: string }> = [];
  for (let n = 1; n <= TAKES; n++) {
    let dur = 0, tx = "";
    for (let t = 0; t < 6; t++) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, { method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ text: `${WORD}.`, model_id: MODEL, language_code: "es", voice_settings: SETTINGS }) });
      if (!r.ok) continue;
      const raw = Buffer.from(await r.arrayBuffer());
      const tmp = join(outDir, "_t.mp3");
      const d0 = await norm(raw, tmp);
      tx = strip(await stt(readFileSync(tmp), apiKey));
      rmSync(tmp, { force: true });
      if (tx === target && d0 >= 0.3 && d0 <= 1.6) { dur = await norm(raw, join(outDir, `av_${n}.mp3`)); break; }
    }
    console.log(`take ${n}: dur ${dur.toFixed(2)}s tx "${tx}"`);
    takes.push({ n, dur, tx });
  }
  const opts = takes.map((d) => `<div class="opt"><div class="num">${d.n}</div><div class="body"><div class="lbl">avisar <span>${d.dur.toFixed(2)}s</span></div><audio controls preload="none" src="/_word-audition/av_${d.n}.mp3"></audio></div></div>`).join("");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>avisar; tomas</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px}
h1{font-size:18px;margin:0 0 4px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.opt{display:flex;align-items:center;gap:14px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04)}
.num{flex:0 0 auto;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:800;background:#1d4ed8;color:#fff}
.body{flex:1}.lbl{font-size:15px;font-weight:700}.lbl span{font-weight:400;color:#8ea0bd;font-size:11px;margin-left:6px}audio{width:100%;margin-top:8px}</style></head><body>
<h1>"avisar"; 5 tomas directas</h1><p class="sub">Citation pace, como el #1 que aprobaste. Dime el número de la que suene mejor y esa fijo.</p>${opts}</body></html>`;
  writeFileSync(join(process.cwd(), "public", "_word-audition.html"), html);
  console.log("\nPage: /_word-audition.html");
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
