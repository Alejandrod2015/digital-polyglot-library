/**
 * Reconstruye el set de práctica de una historia contra SU texto y SU vocab.
 *
 * POR QUÉ (2026-08-17). Al sustituir las tres historias de meeting-people del
 * A0 portugués se cambiaron texto, vocab, audio y fragmentos, pero el set de
 * práctica se quedó apuntando al de las historias viejas: en *O acarajé de
 * Célia* los ejercicios pedían "fita", "pulso" y "nó", que es el vocabulario de
 * *Três nós na fita*, la misma historia cuya portada también había quedado
 * puesta ahí. Se ve comparando la palabra de cada ejercicio con el vocab de su
 * historia: 94-100% fuera en las tres, frente a un máximo de 25% en las otras
 * dieciocho (ese 25% son lemas contra formas conjugadas, que es normal).
 *
 * Usa el constructor canónico `buildAndPersistStoryPracticeSet` con force, o
 * sea las mismas reglas de autoría que el resto del catálogo. Respeta `locked`.
 *
 *   npx tsx scripts/_rebuildPracticeSet.ts <slug> [<slug>...] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { buildAndPersistStoryPracticeSet } from "../src/lib/storyPracticeSets";

const prisma = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** % de ejercicios cuya palabra objetivo NO está en el vocab de la historia. */
async function ajenos(storyId: string): Promise<{ fuera: number; total: number; ejemplos: string[] }> {
  const s = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { vocab: true, practiceSet: { select: { exercises: { select: { word: true } } } } },
  });
  const ex = s?.practiceSet?.exercises ?? [];
  const voc = new Set(((s?.vocab as Array<Record<string, unknown>>) ?? [])
    .map((v) => norm(String(v.word ?? v.term ?? ""))));
  const fuera = ex.filter((e) => !voc.has(norm(e.word)));
  return { fuera: fuera.length, total: ex.length, ejemplos: fuera.slice(0, 4).map((f) => f.word) };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("uso: _rebuildPracticeSet.ts <slug> [<slug>...] [--dry]");

  for (const slug of slugs) {
    const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { id: true, title: true } });
    if (!story) { console.log(`${slug}: no existe`); continue; }

    const antes = await ajenos(story.id);
    console.log(`── ${slug}`);
    console.log(`   antes: ${antes.fuera}/${antes.total} fuera del vocab${antes.ejemplos.length ? `  (${antes.ejemplos.join(", ")})` : ""}`);
    if (dry) continue;

    // `locked` significa "un editor revisó este set". Cuando la historia se
    // SUSTITUYE, esa revisión quedó hecha sobre otro texto y el lock pasa a
    // proteger contenido ajeno: en meeting-people mantenía ejercicios de las
    // historias viejas. Solo se levanta pidiéndolo, y solo para esa historia.
    if (process.argv.includes("--unlock")) {
      await prisma.storyPracticeSet.updateMany({ where: { storyId: story.id }, data: { locked: false } });
      console.log(`   lock levantado (la revisión era de la historia anterior)`);
    }

    const r = await buildAndPersistStoryPracticeSet(story.id, true);
    if (r.status !== "built") { console.log(`   ${r.status}: ${"reason" in r ? r.reason : ""}`); continue; }

    const despues = await ajenos(story.id);
    console.log(`   ahora: ${despues.fuera}/${despues.total} fuera del vocab${despues.ejemplos.length ? `  (${despues.ejemplos.join(", ")})` : ""}`);
  }
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
