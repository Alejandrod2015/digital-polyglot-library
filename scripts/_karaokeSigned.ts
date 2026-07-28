/**
 * Mide el desfase CON SIGNO entre cada arranque de habla real (ffmpeg) y el
 * inicio de palabra mas cercano de los timings guardados.
 *
 * La distancia sin signo del sweep no distingue dos averias muy distintas:
 * un desfase CONSTANTE (todo el karaoke va tarde o pronto, se arregla con un
 * corrimiento) y ruido DISPERSO (la alineacion esta mal en sitios sueltos, no
 * hay corrimiento que lo salve). La mediana con signo y la dispersion lo dicen.
 *
 *   npx tsx scripts/_karaokeSigned.ts --slug a,b,c
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { spawn } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
import { detectSilences } from "../src/lib/detectSilences";

const prisma = new PrismaClient();

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (c) => (c === 0 ? resolve(out + err) : reject(new Error(err.slice(0, 300)))));
  });
}

function mediana(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const i = process.argv.indexOf("--slug");
  const slugs = i >= 0 ? process.argv[i + 1].split(",") : [];

  console.log(`${"historia".padEnd(38)} ${"ons".padStart(4)} ${"medSigno".padStart(9)} ${"p25".padStart(7)} ${"p75".padStart(7)} ${"IQR".padStart(7)} veredicto`);

  for (const slug of slugs) {
    const row =
      (await prisma.catalogStoryAudioTimings.findFirst({ where: { slug }, select: { audioWordTimings: true, story: { select: { audioUrl: true, audio: true } } } })) ?? null;
    if (!row) { console.log(`${slug}: sin timings`); continue; }
    const audio = row.story?.audioUrl || row.story?.audio;
    if (!audio) { console.log(`${slug}: sin audio`); continue; }

    const payload = coerceAudioWordTimings(row.audioWordTimings);
    if (!payload) { console.log(`${slug}: payload invalido`); continue; }

    const silencios = await detectSilences(audio);
    // Arranque de habla = final de cada silencio (y el primero, si el audio
    // no empieza en silencio, lo ignoramos: no hay onset medible ahi).
    const onsets = silencios.map((s) => s.end).filter((t) => t > 0.05);
    const starts = payload.words.map((w) => w.startSec).sort((a, b) => a - b);

    const deltas: number[] = [];
    for (const t of onsets) {
      let mejor = Infinity;
      for (const s of starts) {
        const d = s - t; // + = la palabra empieza DESPUES del habla (karaoke tarde)
        if (Math.abs(d) < Math.abs(mejor)) mejor = d;
      }
      if (Number.isFinite(mejor)) deltas.push(mejor);
    }
    if (deltas.length < 8) { console.log(`${slug}: solo ${deltas.length} onsets, no concluyente`); continue; }

    const orden = [...deltas].sort((a, b) => a - b);
    const p25 = orden[Math.floor(orden.length * 0.25)];
    const p75 = orden[Math.floor(orden.length * 0.75)];
    const med = mediana(deltas);
    const iqr = p75 - p25;
    // Constante = casi todo el error cabe en un corrimiento unico.
    const veredicto = Math.abs(med) > 0.12 && iqr < Math.abs(med) * 1.5 ? "DESFASE CONSTANTE" : "disperso";
    console.log(
      `${slug.padEnd(38)} ${String(deltas.length).padStart(4)} ${med.toFixed(3).padStart(9)} ${p25.toFixed(3).padStart(7)} ${p75.toFixed(3).padStart(7)} ${iqr.toFixed(3).padStart(7)} ${veredicto}`
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
