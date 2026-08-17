/**
 * Vuelca el set de práctica de una historia (de la BASE) al fichero
 * `scripts/_sets/<slug>.json` que espera `_genPracticeClips.ts`.
 *
 * POR QUÉ (2026-08-17). Los clips de práctica se generan con el pipeline
 * canónico `_genPracticeClips.ts`, que incluye el gate F0 y lee el set de un
 * fichero. Pero los sets que nacen del constructor
 * (`buildAndPersistStoryPracticeSet`) viven solo en la base, así que un set
 * reconstruido no tenía fichero y no había forma de generarle el audio sin
 * escribir un pipeline paralelo. Esto es el puente, no un pipeline nuevo.
 *
 *   npx tsx scripts/_dumpSetToFile.ts <slug> [<slug>...]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("uso: _dumpSetToFile.ts <slug> [<slug>...]");
  mkdirSync("scripts/_sets", { recursive: true });

  for (const slug of slugs) {
    const s = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { practiceSet: { select: { exercises: {
        orderBy: { orderIndex: "asc" },
        select: { type: true, word: true, sentence: true, payload: true, featured: true },
      } } } },
    });
    const ex = s?.practiceSet?.exercises ?? [];
    if (!ex.length) { console.log(`${slug}: sin ejercicios`); continue; }
    const salida = ex.map((e) => ({
      type: e.type, word: e.word, sentence: e.sentence, payload: e.payload, featured: e.featured,
    }));
    const f = `scripts/_sets/${slug}.json`;
    writeFileSync(f, JSON.stringify(salida, null, 1));
    console.log(`${slug}: ${salida.length} ejercicios -> ${f}`);
  }
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
