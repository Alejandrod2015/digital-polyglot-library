/**
 * Corta el ÚNICO defecto grande del karaoke que se puede tocar sin romper el
 * resto: las palabras del cuerpo que el alineador coloca ANTES de que el cuerpo
 * empiece a sonar, o sea encima del título y del silencio que le sigue.
 *
 * No reescala nada ni mueve ninguna otra palabra: solo empuja las que caen
 * antes del primer onset real hasta ese onset, repartidas en el hueco que
 * queda hasta la siguiente palabra. Todo lo demás se queda EXACTAMENTE como lo
 * dejó el alineador ([[project_karaoke_drift_correction_removed]]: cualquier
 * corrección global mide peor).
 *
 *   npx tsx scripts/_frKaraokeClampHead.ts <slug> [--apply]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const p = new PrismaClient();

/** Primer instante en que suena el CUERPO: el segundo bloque de voz del máster
 *  (el primero es el título). Sale del perfil de energía, no de whisper: en
 *  este archivo whisper situaba una palabra dentro de un silencio digital. */
function primerOnsetDelCuerpo(mp3: Buffer): number {
  const dir = mkdtempSync(join(tmpdir(), "kh-"));
  const f = join(dir, "a.mp3");
  writeFileSync(f, mp3);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"], { encoding: "utf8" });
  const txt = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const ends = [...txt.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
  if (!ends.length) throw new Error("silencedetect no devolvió onsets");
  return ends[0];
}

(async () => {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  const s: any = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioUrl: true, audioWordTimings: true } });
  const words = s.audioWordTimings.words as Array<{ text: string; startSec: number; endSec: number }>;
  const onset = primerOnsetDelCuerpo(Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
  const fuera = words.filter((w) => w.startSec < onset - 0.05);
  console.log(`el cuerpo empieza a sonar en ${onset.toFixed(2)}s · palabras colocadas antes: ${fuera.length}`);
  fuera.forEach((w) => console.log(`   ${w.text} @ ${w.startSec}s`));
  if (!fuera.length) { await p.$disconnect(); return; }
  const siguiente = words.find((w) => w.startSec >= onset - 0.05);
  const hueco = ((siguiente?.startSec ?? onset + 0.6) - onset) / (fuera.length + 1);
  fuera.forEach((w, i) => {
    const dur = w.endSec - w.startSec;
    w.startSec = +(onset + hueco * i).toFixed(3);
    w.endSec = +(w.startSec + Math.min(dur, hueco)).toFixed(3);
  });
  console.log(`recolocadas en ${onset.toFixed(2)}s..${(siguiente?.startSec ?? 0).toFixed(2)}s`);
  if (!apply) { console.log("--apply para escribir"); await p.$disconnect(); return; }
  await p.journeyStory.update({ where: { id: s.id }, data: { audioWordTimings: { ...s.audioWordTimings, words } as never } });
  console.log("escrito");
  await p.$disconnect();
})();
