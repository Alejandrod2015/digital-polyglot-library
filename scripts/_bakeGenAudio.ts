/**
 * Pre-hornea el audio ElevenLabs de las oraciones GENERADAS (Claude Code) para
 * favoritos, en el MISMO cache key que usa /api/practice/sentence-tts, así el
 * play del cliente da cache hit (instantáneo, nunca mudo).
 *
 * Gate F0 anti-uptalk: mide el contorno final con scripts/_f0gate.py (praat) y
 * re-tira si la oración declarativa sale con entonación de pregunta. Best-effort
 * (si el venv de parselmouth no está, se salta con warning, como los generadores
 * canónicos). El guard 6e exige esta referencia a _f0gate.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadPublicObject, getPublicObjectUrl } from "../src/lib/objectStorage";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

// Inlineados de elevenlabs.ts (ese módulo importa server-only y no carga en tsx).
const DEFAULT_VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const softenPunctuationForTts = (t: string) => t.replace(/!+/g, ".").replace(/\.{2,}/g, ".");

const CACHE_VERSION = "v8"; // DEBE coincidir con sentence-tts/route.ts
const MODEL = "eleven_multilingual_v2";
const VARIANT = "";
const VOICE: Record<string, string> = { spanish: "yHD4CsKkghm19ToGLJEC", italian: "gfKKsLN1k0oYYN9n2dXX", german: "Ww7Sq9tx9CCOiNOwWgsx" };
const F0_PYTHON = `${process.env.HOME}/.cache/dpl-qa/venv/bin/python`;

const SENTENCES: Array<{ s: string; lang: string }> = [
  { lang: "german", s: "Der Duft von frischem Kaffee liegt in der Luft." },
  { lang: "german", s: "Sie bestellt einen Kaffee am Tresen." },
  { lang: "german", s: "Zwischen ihnen sprang sofort ein Funke über." },
  { lang: "german", s: "Für einen Moment stand die Zeit still." },
  { lang: "german", s: "Er packte seinen Koffer für die Reise." },
  { lang: "german", s: "Sie ging durch die vollen Abteile des Zuges." },
  { lang: "german", s: "Ich kaufe die Fahrkarte am Automaten." },
  { lang: "german", s: "Vor dem Auftritt hatte sie starkes Herzklopfen." },
  { lang: "german", s: "Aus dem Fenster sah sie die schöne Landschaft." },
  { lang: "german", s: "Sie brachte viele Neuigkeiten zum Treffen mit." },
  { lang: "german", s: "Er war schon auf dem Sprung zur Arbeit." },
  { lang: "spanish", s: "Voy a colgar el teléfono en un momento." },
  { lang: "spanish", s: "Los senderos del bosque son estrechos y verdes." },
  { lang: "spanish", s: "La familia adornó el altar con flores y velas." },
  { lang: "italian", s: "Giulia è una donna calma ma molto determinata." },
  { lang: "italian", s: "Devo avvolgere il regalo con carta rossa." },
  { lang: "italian", s: "Prende la forchetta e assaggia la pasta." },
  // Lote 2 (todos alemán)
  { lang: "german", s: "Das Kind wollte die bittere Medizin sofort ausspucken." },
  { lang: "german", s: "Sie kämpfte lange mit ihren Tränen." },
  { lang: "german", s: "Der Bahnhof ist ein wichtiger Knotenpunkt der Stadt." },
  { lang: "german", s: "Im Café hörte man nur ein leises Stimmengewirr." },
  { lang: "german", s: "Die Durchsage kündigte eine Verspätung an." },
  { lang: "german", s: "Die Sonne brannte gnadenlos auf den Platz." },
  { lang: "german", s: "Der Himmel wurde allmählich dunkler." },
  { lang: "german", s: "Der Bus musste durch den Verkehr kriechen." },
];

function keyFor(language: string, voiceId: string, sentence: string): string {
  const hash = crypto.createHash("sha256").update(`${CACHE_VERSION}|el|${language}|${VARIANT}|${voiceId}|${sentence}`).digest("hex").slice(0, 24);
  return `media/practice/tts/el-${hash}.mp3`;
}
function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", args); let e = ""; p.stderr.on("data", (c) => (e += c)); p.on("error", rej); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))); });
}
let f0Warned = false;
function f0Falling(mp3: string): Promise<boolean> {
  // scripts/_f0gate.py <mp3> statement → exit 0 si el contorno final CAE (ok statement)
  return new Promise((res) => {
    const p = spawn(F0_PYTHON, ["scripts/_f0gate.py", mp3, "statement"]);
    p.on("error", () => { if (!f0Warned) { f0Warned = true; console.log("WARN f0 gate saltado (venv no disponible)"); } res(true); });
    p.on("close", (c) => res(c === 0));
  });
}
async function renderEL(text: string, voiceId: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: softenPunctuationForTts(text), model_id: MODEL, voice_settings: DEFAULT_VOICE_SETTINGS }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text()).slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}
async function post(raw: Buffer, outPath: string): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "bk-")); const i = join(dir, "i.mp3");
  try { writeFileSync(i, raw); await ff(["-y", "-loglevel", "error", "-i", i, "-af", "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing (revisa .env.local)");
  let baked = 0, cached = 0;
  for (const { s, lang } of SENTENCES) {
    const voiceId = VOICE[lang];
    assertVoiceApproved(voiceId, `bake:${lang}`);
    const key = keyFor(lang, voiceId, s);
    const url = getPublicObjectUrl(key);
    if (url) { try { const h = await fetch(url, { method: "HEAD" }); if (h.ok) { cached++; console.log(`cache ✓ ${s.slice(0, 40)}`); continue; } } catch { /* render */ } }
    const dir = mkdtempSync(join(tmpdir(), "bk2-")); const out = join(dir, "o.mp3");
    try {
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        const raw = await renderEL(s, voiceId, apiKey);
        await post(raw, out);
        ok = await f0Falling(out);
        if (!ok) console.log(`  re-tira (uptalk) intento ${attempt + 1}: ${s.slice(0, 30)}`);
      }
      const up = await uploadPublicObject({ key, body: readFileSync(out), contentType: "audio/mpeg" });
      if (!up?.url) throw new Error("R2 upload failed");
      baked++; console.log(`horneado ✓ [${lang}] ${s}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  console.log(`\nhorneados: ${baked} | ya en cache: ${cached} | total: ${SENTENCES.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
