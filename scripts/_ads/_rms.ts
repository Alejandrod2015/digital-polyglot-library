/** Scratch: perfil de energia en marcos de 20 ms. Uso: _rms.ts <mp3> <ss> <dur> */
import { execFileSync } from "node:child_process";
const [file, ss, dur] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const pcm = execFileSync("ffmpeg", ["-v", "error", "-ss", String(ss), "-t", String(dur), "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const N = 160;
for (let i = 0, k = 0; i + N * 2 <= pcm.length; i += N * 2, k++) {
  let s = 0;
  for (let j = 0; j < N; j++) { const v = pcm.readInt16LE(i + j * 2) / 32768; s += v * v; }
  const db = 20 * Math.log10(Math.sqrt(s / N) + 1e-9);
  const t = ss + k * 0.02;
  console.log(t.toFixed(2), db.toFixed(1).padStart(6), "#".repeat(Math.max(0, Math.round(db + 60) / 2)));
}
