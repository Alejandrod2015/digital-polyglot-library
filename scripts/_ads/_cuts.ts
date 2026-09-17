/** Solo LECTURA: silencios REALES del mp3 alrededor del inicio y del final de
 *  una ventana, para elegir el corte con datos y no a ojo. */
import { PrismaClient } from "../../src/generated/prisma";
import { execFileSync } from "node:child_process";
const p = new PrismaClient();
const [title, fromS, toS] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title }, select: { audioUrl: true, audioWordTimings: true } });
  const w = (s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }> }).words;
  const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", s!.audioUrl!, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const pcm = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  const W = 400, env: number[] = [];
  for (let i = 0; i + W < pcm.length; i += W) { let a = 0; for (let j = 0; j < W; j++) a += pcm[i + j] * pcm[i + j]; env.push(Math.sqrt(a / W)); }
  const segs: Array<[number, number]> = []; let on = false, st = 0;
  for (let i = 0; i < env.length; i++) {
    if (env[i] > 250 && !on) { on = true; st = i; }
    else if (env[i] <= 250 && on) { on = false; if ((i - st) * 0.05 > 0.12) segs.push([st * 0.05, i * 0.05]); }
  }
  const near = (t: number) => segs.filter(([a, b]) => b > t - 3 && a < t + 3).map(([a, b]) => `${a.toFixed(2)}-${b.toFixed(2)}`);
  console.log(`primera palabra "${w[fromS].text}" alineada en ${w[fromS].startSec.toFixed(2)}; voz cerca:`, near(w[fromS].startSec).join("  "));
  console.log(`ultima palabra  "${w[toS].text}" alineada hasta ${w[toS].endSec.toFixed(2)}; voz cerca:`, near(w[toS].endSec).join("  "));
  await p.$disconnect();
})();
