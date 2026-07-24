/**
 * _qaTailSurvey.ts — mide la cola POST-habla de cada clip del catálogo para
 * cazar respiraciones finales ("como si fuera a continuar hablando", el 2º
 * defecto más frecuente según el usuario, 2026-07-23).
 *
 *   npx tsx scripts/_qaTailSurvey.ts <cacheDir> <out.jsonl>
 *
 * Por clip (mp3 ya cacheado por _qaAuditCatalog): whisper da el fin del habla;
 * en la ventana [speechEnd+0.05, EOF] se mide max dB y la duración del sonido
 * por encima de -35 dB (una respiración audible es un lomo de -32..-20 dB y
 * 0.2-0.6 s; el gate de cola actual solo rechaza > -20 dB).
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import { whisperAnalyze } from "./_qaEar";

const WLANG: Record<string, string> = { es: "es", de: "de" };

function sh(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args); let o = "", e = "";
    p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (e += c));
    p.on("error", rej); p.on("close", (code) => res({ code: code ?? 1, out: o, err: e }));
  });
}

(async () => {
  const [cache, outPath] = [process.argv[2], process.argv[3]];
  if (!cache || !outPath) throw new Error("uso: _qaTailSurvey.ts <cacheDir> <out.jsonl>");
  const rows = JSON.parse(readFileSync("scripts/_qa_audit_report_final.json", "utf8"));
  writeFileSync(outPath, "");
  let idx = 0, done = 0;
  async function worker() {
    while (idx < rows.length) {
      const r = rows[idx++];
      const mp3 = join(cache, crypto.createHash("sha1").update(r.url).digest("hex").slice(0, 20) + ".mp3");
      const res: Record<string, unknown> = { key: r.key };
      try {
        if (!existsSync(mp3)) throw new Error("no cache");
        const w = await whisperAnalyze(mp3, WLANG[r.lang]);
        if (!w) throw new Error("sin habla");
        const pr = await sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]);
        const dur = parseFloat(pr.out.trim());
        const t0 = w.speechEndSec + 0.05;
        res.speechEnd = +w.speechEndSec.toFixed(2); res.dur = +dur.toFixed(2);
        if (t0 < dur - 0.05) {
          const v = await sh("ffmpeg", ["-i", mp3, "-af", `atrim=start=${t0},volumedetect`, "-f", "null", "-"]);
          const m = v.err.match(/max_volume:\s*(-?[\d.]+) dB/);
          res.tailDb = m ? parseFloat(m[1]) : null;
          // duración de sonido audible (>-35 dB) en la cola = lomo de respiración
          const sd = await sh("ffmpeg", ["-i", mp3, "-af", `atrim=start=${t0},silencedetect=noise=-35dB:d=0.1`, "-f", "null", "-"]);
          let audible = dur - t0;
          const reSil = /silence_duration:\s*([\d.]+)/g; let mm: RegExpExecArray | null;
          while ((mm = reSil.exec(sd.err)) !== null) audible -= parseFloat(mm[1]);
          res.breathSec = +Math.max(0, audible).toFixed(2);
        } else { res.tailDb = null; res.breathSec = 0; }
      } catch (err) { res.error = (err as Error).message.slice(0, 60); }
      appendFileSync(outPath, JSON.stringify(res) + "\n");
      if (++done % 200 === 0) console.log(`${done}/${rows.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`listo: ${done}`);
})();
