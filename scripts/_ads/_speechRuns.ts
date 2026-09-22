/** Scratch: tramos de VOZ en una ventana del mp3, con histeresis.
 *  Voz si pasa de -38 dB; se cierra cuando baja de -52 dB durante >=0,18 s.
 *  Uso: _speechRuns.ts <mp3> <ss> <dur> */
import { execFileSync } from "node:child_process";
const [file, ss, dur] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const pcm = execFileSync("ffmpeg", ["-v", "error", "-ss", String(ss), "-t", String(dur), "-i", file, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const N = 160, HOP = 0.02, ON = -38, OFF = -52, GAP = 0.18;
const db: number[] = [];
for (let i = 0; i + N * 2 <= pcm.length; i += N * 2) {
  let s = 0;
  for (let j = 0; j < N; j++) { const v = pcm.readInt16LE(i + j * 2) / 32768; s += v * v; }
  db.push(20 * Math.log10(Math.sqrt(s / N) + 1e-9));
}
const runs: Array<[number, number]> = [];
let start = -1, quiet = 0;
db.forEach((d, k) => {
  const t = ss + k * HOP;
  if (start === -1) { if (d > ON) { start = t; quiet = 0; } return; }
  if (d < OFF) {
    quiet += HOP;
    if (quiet >= GAP) { runs.push([start, t - quiet]); start = -1; quiet = 0; }
  } else quiet = 0;
});
if (start !== -1) runs.push([start, ss + db.length * HOP]);
runs.forEach(([a, b]) => console.log(`  voz ${a.toFixed(2)} -> ${b.toFixed(2)}  (${(b - a).toFixed(2)}s)`));
