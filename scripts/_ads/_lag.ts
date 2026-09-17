/** Solo LECTURA: mide el DESFASE entre el alineado y el audio real de una historia.
 *  Compara los silencios del mp3 con los finales de frase del alineado. */
import { PrismaClient } from "../../src/generated/prisma";
import { execFileSync } from "node:child_process";
const p = new PrismaClient();
(async () => {
  for (const title of ["La once con chirrido", "Los aguanto de dos en dos", "Aquí se dice arrendando"]) {
    const s = await p.journeyStory.findFirst({ where: { title }, select: { audioUrl: true, audioWordTimings: true } });
    const tim = s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number; charEnd: number }>; storyPlainText: string };
    const plain = tim.storyPlainText;
    const ends = tim.words.filter((w) => /[.!?]/.test(plain.slice(w.charEnd, w.charEnd + 3))).map((w) => w.endSec);
    const buf = execFileSync("ffmpeg", ["-loglevel", "error", "-i", s!.audioUrl!, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
    const pcm = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
    const W = 400, env: number[] = [];
    for (let i = 0; i + W < pcm.length; i += W) { let acc = 0; for (let j = 0; j < W; j++) acc += pcm[i + j] * pcm[i + j]; env.push(Math.sqrt(acc / W)); }
    const quiet: number[] = []; let run = 0;
    for (let i = 0; i < env.length; i++) {
      if (env[i] < 250) { run++; } else { if (run * 0.05 >= 0.35) quiet.push(Math.round((i - run) * 0.05 * 100) / 100); run = 0; }
    }
    const lags: number[] = [];
    for (const e of ends) { let best = Infinity; for (const q of quiet) if (Math.abs(q - e) < Math.abs(best)) best = q - e; if (Math.abs(best) < 4) lags.push(Math.round(best * 100) / 100); }
    lags.sort((a, b) => a - b);
    console.log(title, "| finales de frase:", ends.length, "| silencios:", quiet.length, "| desfase mediano:", lags[Math.floor(lags.length / 2)], "| muestra:", lags.slice(0, 8));
  }
  await p.$disconnect();
})();
