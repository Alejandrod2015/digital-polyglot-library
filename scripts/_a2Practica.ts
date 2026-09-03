/**
 * Construye el set de practica de TODAS las historias de un journey con el
 * constructor canonico, sin gastar creditos de TTS (escribe audioUrl null; el
 * render de clips es un paso aparte, con su gate F0).
 *
 * Por que hace falta un lanzador propio (project_practice_autobuilder_limits):
 *  - `seedStoryPracticeSets.ts` filtra `status: "published"`, y este journey
 *    esta en draft, asi que no lo tocaria.
 *  - `src/lib/prisma` importa `server-only`, y los `import` se izan por encima
 *    del shim, asi que prisma y el constructor se cargan con createRequire
 *    DESPUES de neutralizar el guard.
 *
 *   npx tsx scripts/_a2Practica.ts [journeyId] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { createRequire } from "module";
const req = createRequire(__filename);
try {
  const p = req.resolve("server-only");
  (req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

const { PrismaClient } = req("../src/generated/prisma") as typeof import("../src/generated/prisma");
const { buildAndPersistStoryPracticeSet } = req("../src/lib/storyPracticeSets") as typeof import("../src/lib/storyPracticeSets");

const prisma = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

(async () => {
  const dry = process.argv.includes("--dry");
  const journeyId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "cmtgelq560007j84n3ujx9bpd";

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { id: true, slug: true, title: true, vocab: true },
  });
  console.log(`${stories.length} historias · ${dry ? "DRY" : "escribiendo"}`);

  for (const s of stories) {
    if (dry) { console.log(`  ${s.slug}: (dry)`); continue; }
    await buildAndPersistStoryPracticeSet(s.id, { force: true });
    const set = await prisma.storyPracticeSet.findFirst({
      where: { storyId: s.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, exercises: { select: { word: true, type: true, featured: true } } },
    });
    const ex = set?.exercises ?? [];
    const voc = new Set(((s.vocab as Array<Record<string, unknown>>) ?? []).map((v) => norm(String(v.word ?? ""))));
    const fuera = ex.filter((e) => !voc.has(norm(e.word))).length;
    const feat = ex.filter((e) => e.featured).length;
    console.log(`  ${s.slug}: ${ex.length} ejercicios (${feat} featured) · ${fuera} fuera del vocab`);
  }
  await prisma.$disconnect();
})();
