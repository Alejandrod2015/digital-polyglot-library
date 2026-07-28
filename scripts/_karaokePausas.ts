/**
 * Correlaciona las pausas LARGAS del audio con el error de karaoke.
 *
 * Hipotesis: aeneas reparte palabras a lo largo de un silencio en vez de
 * dejarlo vacio, asi que cada pausa dramatica larga empuja tarde lo que viene
 * detras hasta el siguiente anclaje. Si es eso, las historias con mas SEGUNDOS
 * en pausas largas deben ser las que peor puntuan.
 *
 *   npx tsx scripts/_karaokePausas.ts <score.json>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { detectSilences } from "../src/lib/detectSilences";

const prisma = new PrismaClient();
const LARGA = 0.8;

async function main() {
  const scores = JSON.parse(readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; medianAbsSec: number }>;
  const filas: Array<{ slug: string; med: number; nLargas: number; segLargas: number; pctLargas: number }> = [];

  for (const s of scores) {
    const story = await prisma.catalogStory.findFirst({ where: { slug: s.slug }, select: { audio: true, audioUrl: true } });
    const audio = story?.audioUrl || story?.audio;
    if (!audio) continue;
    const sil = await detectSilences(audio);
    const largas = sil.filter((x) => x.end - x.start >= LARGA);
    const segLargas = largas.reduce((n, x) => n + (x.end - x.start), 0);
    const dur = sil.length ? sil[sil.length - 1].end : 0;
    filas.push({ slug: s.slug, med: s.medianAbsSec, nLargas: largas.length, segLargas, pctLargas: dur ? segLargas / dur : 0 });
  }

  filas.sort((a, b) => b.med - a.med);
  console.log(`${"historia".padEnd(34)} ${"med".padStart(6)} ${"pausas>=0.8s".padStart(13)} ${"seg".padStart(7)} ${"% del audio".padStart(11)}`);
  for (const f of filas) {
    console.log(`${f.slug.padEnd(34)} ${f.med.toFixed(3).padStart(6)} ${String(f.nLargas).padStart(13)} ${f.segLargas.toFixed(0).padStart(7)} ${(f.pctLargas * 100).toFixed(1).padStart(11)}`);
  }

  // Correlacion de Pearson entre segundos en pausas largas y error.
  const n = filas.length;
  const mx = filas.reduce((a, f) => a + f.pctLargas, 0) / n;
  const my = filas.reduce((a, f) => a + f.med, 0) / n;
  const cov = filas.reduce((a, f) => a + (f.pctLargas - mx) * (f.med - my), 0);
  const sx = Math.sqrt(filas.reduce((a, f) => a + (f.pctLargas - mx) ** 2, 0));
  const sy = Math.sqrt(filas.reduce((a, f) => a + (f.med - my) ** 2, 0));
  console.log(`\ncorrelacion (% del audio en pausas largas vs error mediano): r = ${(cov / (sx * sy)).toFixed(2)} sobre ${n} historias`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
