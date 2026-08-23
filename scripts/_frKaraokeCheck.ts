/** Comprueba con el AUDIO (perfil de energía, no whisper) que el karaoke de una
 *  historia arranca donde suena: cuántas palabras se encienden antes de que
 *  empiece el cuerpo y cuántas lo hacen con más de 0,30 s de silencio delante. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const p = new PrismaClient();

(async () => {
  for (const slug of process.argv.slice(2)) {
    const s: any = await p.journeyStory.findFirst({ where: { slug }, select: { audioUrl: true, audioWordTimings: true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin audio`); continue; }
    const dir = mkdtempSync(join(tmpdir(), "kc-"));
    const mp3 = join(dir, "a.mp3"), wav = join(dir, "a.wav");
    writeFileSync(mp3, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
    spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp3, "-ar", "16000", "-ac", "1", wav]);
    const buf = readFileSync(wav);
    const pcm = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) >> 1);
    const SR = 16000;
    const rms = (t0: number, t1: number) => {
      const a = Math.max(0, Math.floor(t0 * SR)), b = Math.min(pcm.length, Math.floor(t1 * SR));
      if (b <= a) return -99;
      let acc = 0; for (let i = a; i < b; i++) acc += pcm[i] * pcm[i];
      return 20 * Math.log10(Math.sqrt(acc / (b - a)) / 32768 + 1e-9);
    };
    const dur = pcm.length / SR;
    const espera = (t: number) => { let x = t; while (x < dur && rms(x, x + 0.05) < -50) x += 0.05; return x - t; };
    // primer onset del cuerpo: tras el título y su silencio
    const r = spawnSync("ffmpeg", ["-hide_banner", "-i", mp3, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"], { encoding: "utf8" });
    const onset = Number((`${r.stdout ?? ""}${r.stderr ?? ""}`.match(/silence_end: ([0-9.]+)/) ?? [])[1] ?? 0);
    const words = (s.audioWordTimings?.words ?? []) as Array<{ startSec: number }>;
    const antes = words.filter((w) => w.startSec < onset - 0.05).length;
    const esperas = words.map((w) => espera(w.startSec));
    const graves = esperas.filter((e) => e > 0.3);
    console.log(`${slug.padEnd(34)} cuerpo desde ${onset.toFixed(2)}s · antes: ${antes} · >0,30s de silencio: ${graves.length}/${words.length} · peor ${Math.max(...esperas).toFixed(2)}s`);
  }
  await p.$disconnect();
})();
