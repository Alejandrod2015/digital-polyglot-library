/**
 * _qaAudioClip.ts: "oído automático" standalone, veredicto pass/fail de UN
 * clip TTS contra su oración esperada, con razones legibles.
 *
 *   npx tsx scripts/_qaAudioClip.ts <mp3> "<oración esperada>" [--lang=es|de] [--json]
 *
 * Capas (las mismas del pipeline _genPracticeClips, aquí auditables a demanda
 * sobre clips ya renderizados; NO genera audio):
 *   1. coverage fonético (_qaEar.ts): Scribe (si hay ELEVENLABS_API_KEY) +
 *      whisper local; tolera dialecto intencional y grafías de nombres, caza
 *      palabras dropeadas/alucinadas y truncados. Calibrado en _qaEarTest.ts.
 *   2. tail-artifact: audio fuerte tras el último token transcrito (> -20 dB).
 *   3. F0: pregunta sí/no que termina plana = fail (statement solo warn).
 *
 * Sin API key corre con whisper solo (motor único, algo más estricto).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import { phoneticCoverage, whisperAnalyze, internalGaps, rateCheck, GAP_MAX_SEC, RATE_MIN, RATE_MAX } from "./_qaEar";

const LANGS: Record<string, { whisper: string; scribe: string; wh: RegExp }> = {
  es: { whisper: "es", scribe: "spa", wh: /(qué|quién|quiénes|cómo|cuándo|dónde|adónde|cuál|cuáles|cuánto|cuánta|cuántos|cuántas)/i },
  de: { whisper: "de", scribe: "deu", wh: /(\bwer\b|\bwen\b|\bwem\b|\bwessen\b|\bwas\b|\bwie\b|\bwieso\b|\bweshalb\b|\bwarum\b|\bwann\b|\bwo\b|\bwohin\b|\bwoher\b|\bwelch)/i },
};
const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const TAIL_MAX_DB = -20; // umbral medido en 31 clips etiquetados (ver _genPracticeClips)

function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}

function envKey(): string | null {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try { return readFileSync(".env.local", "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1].trim() ?? null; } catch { return null; }
}

async function scribe(mp3: string, langCode: string, key: string): Promise<string | null> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", langCode);
  fd.append("file", new Blob([new Uint8Array(readFileSync(mp3))], { type: "audio/mpeg" }), "s.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd });
  if (!res.ok) return null;
  return (((await res.json()) as { text?: string }).text || "").trim() || null;
}

// tail-artifact (misma geometría que _genPracticeClips.tailClean); reusa el
// tramo hablado que ya midió whisperAnalyze en vez de re-correr whisper.
async function tailCheck(mp3: string, speechEndSec: number | null): Promise<{ ok: boolean; note: string }> {
  if (speechEndSec === null) return { ok: true, note: "skipped (sin tramo whisper)" };
  const pr = await spawnCapture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]);
  const dur = parseFloat(pr.out.trim());
  const start = speechEndSec + 0.06;
  if (!isFinite(dur) || start >= dur) return { ok: true, note: "sin cola tras el último token" };
  const v = await spawnCapture("ffmpeg", ["-i", mp3, "-af", `atrim=start=${start},volumedetect`, "-f", "null", "-"]);
  const m = v.err.match(/max_volume:\s*(-?[\d.]+) dB/);
  const db = m ? parseFloat(m[1]) : null;
  return { ok: db === null || db <= TAIL_MAX_DB, note: `cola ${db ?? "?"} dB tras último token (umbral ${TAIL_MAX_DB})` };
}

async function f0Check(mp3: string, sentence: string, wh: RegExp): Promise<{ ok: boolean; note: string }> {
  try {
    const isQ = sentence.trim().endsWith("?") && !wh.test(sentence) && !/^\s*¿\s*y\s+si\b/i.test(sentence);
    const r = await spawnCapture(F0_PYTHON, ["scripts/_f0gate.py", mp3, isQ ? "question" : "statement"]);
    if (r.code !== 0) throw new Error(r.err.slice(0, 80));
    const v = JSON.parse(r.out.trim());
    return { ok: !!v.ok, note: `${v.reason} (slope ${v.slope}, end ${v.end})` };
  } catch (err) {
    return { ok: true, note: `skipped (${(err as Error).message})` };
  }
}

(async () => {
  const [mp3, sentence] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const langKey = process.argv.find((a) => a.startsWith("--lang="))?.slice(7) ?? "es";
  const asJson = process.argv.includes("--json");
  const L = LANGS[langKey];
  if (!mp3 || !sentence || !L) {
    console.error('uso: npx tsx scripts/_qaAudioClip.ts <mp3> "<oración>" [--lang=es|de] [--json]');
    process.exit(2);
  }
  if (!existsSync(mp3)) { console.error(`no existe: ${mp3}`); process.exit(2); }

  const key = envKey();
  const [txScribe, wInfo] = await Promise.all([
    key ? scribe(mp3, L.scribe, key) : Promise.resolve(null),
    whisperAnalyze(mp3, L.whisper),
  ]);
  const txWhisper = wInfo?.text ?? null;
  if (!txScribe && !txWhisper) { console.error("sin STT disponible (ni Scribe ni whisper)"); process.exit(2); }

  const reasons: { layer: string; ok: boolean; note: string }[] = [];
  const ear = phoneticCoverage(sentence, txScribe ?? txWhisper!, txScribe ? txWhisper : null, langKey);
  reasons.push({ layer: "fonética", ok: ear.ok, note: `${ear.detail}${txScribe ? ` · scribe="${txScribe}"` : ""}${txWhisper ? ` · whisper="${txWhisper}"` : ""}` });
  if (wInfo) {
    const gaps = await internalGaps(mp3, wInfo.speechStartSec, wInfo.speechEndSec);
    reasons.push({
      layer: "huecos", ok: gaps.length === 0,
      note: gaps.length ? gaps.map((g) => `silencio de ${g.dur.toFixed(2)}s en ${g.start.toFixed(2)}s`).join("; ") : `sin silencios internos ≥${GAP_MAX_SEC}s`,
    });
    const rate = rateCheck(sentence, langKey, wInfo.speechEndSec - wInfo.speechStartSec);
    reasons.push({ layer: "velocidad", ok: rate.ok, note: `${rate.rate} fonemas/seg (banda ${RATE_MIN}-${RATE_MAX})` });
  }
  const tail = await tailCheck(mp3, wInfo ? wInfo.speechEndSec : null);
  reasons.push({ layer: "tail", ok: tail.ok, note: tail.note });
  const f0 = await f0Check(mp3, sentence, L.wh);
  reasons.push({ layer: "f0", ok: f0.ok, note: f0.note });

  const pass = reasons.every((r) => r.ok);
  if (asJson) console.log(JSON.stringify({ pass, mp3, sentence, lang: langKey, reasons }, null, 2));
  else {
    console.log(`${pass ? "PASS" : "FAIL"}  ${mp3}`);
    for (const r of reasons) console.log(`  [${r.ok ? "ok" : "XX"}] ${r.layer}: ${r.note}`);
  }
  process.exit(pass ? 0 : 1);
})();
