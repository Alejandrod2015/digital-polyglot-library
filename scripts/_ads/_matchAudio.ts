/** Scratch: comprueba que el audio de un tramo del anuncio ES el de la
 *  historia. Compara la ENVOLVENTE (RMS en marcos de 20 ms) y busca el
 *  desfase que mejor casa; devuelve correlacion y desfase. */
import { execFileSync } from "node:child_process";

function env(file: string, ss: number, dur: number): number[] {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-ss", String(ss), "-t", String(dur), "-i", file,
    "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const N = 160; // 20 ms a 8 kHz
  const out: number[] = [];
  for (let i = 0; i + N * 2 <= pcm.length; i += N * 2) {
    let s = 0;
    for (let k = 0; k < N; k++) { const v = pcm.readInt16LE(i + k * 2) / 32768; s += v * v; }
    out.push(Math.sqrt(s / N));
  }
  return out;
}

function corr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return num / Math.sqrt(da * db);
}

const [adFile, srcFile, adStart, srcStart, dur] = [process.argv[2], process.argv[3], Number(process.argv[4]), Number(process.argv[5]), Number(process.argv[6])];
const a = env(adFile, adStart, dur);
let best = { lag: 0, r: -2 };
for (let lag = -25; lag <= 25; lag++) {           // +-500 ms
  const b = env(srcFile, srcStart + lag * 0.02, dur);
  const r = corr(a, b);
  if (r > best.r) best = { lag: lag * 0.02, r };
}
console.log(`  correlacion ${best.r.toFixed(3)} con desfase ${best.lag >= 0 ? "+" : ""}${best.lag.toFixed(2)}s`);
