/**
 * Escribe los `clipUrl` recien generados en las FILAS de practica que ya
 * existen en la base, sin reconstruir el set.
 *
 * POR QUE (2026-08-24). El puente `_dumpSetToFile.ts` vuelca el set a fichero
 * para que `_genPracticeClips.ts` (el pipeline canonico, con su gate F0) pueda
 * generarle el audio. La vuelta, en cambio, no vale: `_seedAllSets.ts` BORRA el
 * set y lo reinserta validandolo contra la plantilla de los sets CURADOS, y un
 * set nacido de `buildAndPersistStoryPracticeSet` tiene otra forma (sin
 * `[[ ]]`, sin `optionTranslations`, la respuesta no va primera). Los 21 sets
 * del A2 salian con ~78 "issues" cada uno y el seed los bloqueaba.
 *
 * Aqui no se reconstruye nada: se casa cada ejercicio del fichero con su fila
 * por (historia, tipo, palabra, oracion) y se actualiza SOLO
 * `payload.audioClip.clipUrl`. Es el mismo UPDATE puntual que ya hace
 * `_genWordClips.ts` para `wordClipUrl`.
 *
 *   npx tsx scripts/_a2/aplicaClips.ts <slug> [<slug>...] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { readFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const CLIP_TYPES = new Set(["fill_blank", "meaning_in_context"]);
const norm = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();

(async () => {
  const dry = process.argv.includes("--dry");
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("uso: aplicaClips.ts <slug> [<slug>...] [--dry]");

  let escritos = 0, yaEstaban = 0, sinPareja = 0, sinClip = 0;
  for (const slug of slugs) {
    const file: any[] = JSON.parse(readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
    const story = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, sentence: true, payload: true } } } } },
    });
    const filas = story?.practiceSet?.exercises ?? [];
    if (!filas.length) { console.log(`  ! ${slug}: sin set en la base`); continue; }

    const porClave = new Map<string, typeof filas>();
    for (const f of filas) {
      const k = `${f.type}|${norm(f.word)}|${norm(f.sentence)}`;
      (porClave.get(k) ?? porClave.set(k, []).get(k)!).push(f);
    }

    let n = 0;
    for (const e of file) {
      if (!CLIP_TYPES.has(e.type)) continue;
      const url = e.payload?.audioClip?.clipUrl;
      if (!url) { sinClip++; continue; }
      const k = `${e.type}|${norm(e.word)}|${norm(e.sentence)}`;
      const cands = porClave.get(k);
      if (!cands?.length) { sinPareja++; console.log(`  ✗ ${slug}: sin pareja ${e.type} "${e.word}"`); continue; }
      const fila = cands.shift()!;
      const prev = (fila.payload as any) ?? {};
      if (prev?.audioClip?.clipUrl === url) { yaEstaban++; continue; }
      const nuevo = { ...prev, audioClip: { ...(prev.audioClip ?? {}), ...(e.payload.audioClip ?? {}), clipUrl: url } };
      if (!dry) {
        await prisma.$executeRawUnsafe(
          `UPDATE dp_story_practice_exercises_v1 SET payload=$1::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`,
          JSON.stringify(nuevo), fila.id,
        );
      }
      escritos++; n++;
    }
    console.log(`  ${slug}: ${n} clips${dry ? " (dry)" : ""}`);
  }
  console.log(`\nescritos ${escritos} · ya estaban ${yaEstaban} · sin pareja ${sinPareja} · sin clip en fichero ${sinClip}`);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
