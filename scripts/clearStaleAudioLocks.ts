/**
 * Libera los candados de audio caducados: historias que llevan en
 * `audioStatus = "generating"` mas de AUDIO_LOCK_TTL_MS sin que nadie las
 * toque. Ver src/lib/staleAudioLock.ts para el porque.
 *
 * La lectura del monitor ya los ignora (no muestra "generando" lo que no lo
 * esta), pero el dato crudo seguia mintiendo; esto lo corrige en la base.
 *
 * NO genera audio ni toca ElevenLabs: solo cambia el estado a "pending", que
 * es el que tenian antes de que empezara el render que murio.
 *
 *   npx tsx scripts/clearStaleAudioLocks.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { AUDIO_LOCK_TTL_MS, isStaleAudioLock } from "../src/lib/staleAudioLock";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const ahora = Date.now();
  const enCurso = await prisma.journeyStory.findMany({
    where: { audioStatus: "generating" },
    select: { id: true, slug: true, audioStatus: true, audioUrl: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });

  const caducados = enCurso.filter((s) => isStaleAudioLock(s.audioStatus, s.updatedAt, ahora));
  const vivos = enCurso.length - caducados.length;

  console.log(`en "generating": ${enCurso.length} | caducados (> ${Math.round(AUDIO_LOCK_TTL_MS / 60000)} min): ${caducados.length} | posiblemente en curso: ${vivos}`);
  for (const s of caducados) {
    const horas = Math.round((ahora - s.updatedAt.getTime()) / 3_600_000);
    console.log(`  ${s.slug.padEnd(36)} ${horas}h colgada  audio=${s.audioUrl ? "SI" : "no"}`);
  }

  if (APPLY && caducados.length > 0) {
    const { count } = await prisma.journeyStory.updateMany({
      where: { id: { in: caducados.map((s) => s.id) } },
      // "pending" y no "failed": no sabemos que fallara, sabemos que nadie
      // la esta generando. "failed" afirmaria algo que no medimos.
      data: { audioStatus: "pending" },
    });
    console.log(`\nliberados: ${count}`);
  } else {
    console.log(APPLY ? "\nnada que liberar" : "\n(dry run, usa --apply)");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
