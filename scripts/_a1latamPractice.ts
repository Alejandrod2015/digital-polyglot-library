/**
 * Construye el set de práctica de las 21 del A1 latam con el constructor
 * CANÓNICO (`buildAndPersistStoryPracticeSet`), las mismas reglas de autoría
 * que el resto del catálogo. No cambia el estado de ninguna historia: el
 * filtro `status: "published"` vive solo en `seedStoryPracticeSets.ts`, no en
 * el constructor.
 *
 * El neutralizador de `server-only` es el mismo de `scripts/saveStory.ts`: el
 * constructor importa `@/lib/prisma`, que lleva el guard de servidor.
 *
 *   npx tsx scripts/_a1latamPractice.ts --dry
 *   npx tsx scripts/_a1latamPractice.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = { id: p, filename: p, loaded: true, exports: {} };
} catch { /* noop */ }

import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

(async () => {
  const { buildAndPersistStoryPracticeSet } = await import("../src/lib/storyPracticeSets");
  const dry = process.argv.includes("--dry");
  const force = process.argv.includes("--force");
  const j = await prisma.journey.findUnique({ where: { id: A1 }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const stories = (await prisma.journeyStory.findMany({
    where: { journeyId: A1, text: { not: null } },
    select: { id: true, slug: true, title: true, topic: true, slotIndex: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  console.log(`${stories.length} historias con texto${dry ? " (dry)" : ""}\n`);
  let hechas = 0, saltadas = 0;
  for (const s of stories) {
    if (dry) { console.log(`  · ${s.slug}  vocab=${((s.vocab as unknown[]) ?? []).length}`); continue; }
    const r = await buildAndPersistStoryPracticeSet(s.id, force);
    if (r.status === "skipped") { saltadas++; console.log(`  · ${s.slug}: saltada (${r.reason})`); }
    else { hechas++; console.log(`  ✓ ${s.slug}: ${r.status} (${r.count} ejercicios)`); }
  }
  if (!dry) {
    // Control de que cada ejercicio apunta al vocab de SU historia, igual que
    // mide `_rebuildPracticeSet.ts`.
    let fuera = 0, total = 0;
    for (const s of stories) {
      const set = await prisma.storyPracticeSet.findFirst({
        where: { storyId: s.id }, select: { exercises: { select: { word: true } } },
      });
      const voc = new Set((((s.vocab as Array<Record<string, unknown>>) ?? []))
        .map((v) => norm(String(v.word ?? ""))));
      for (const e of set?.exercises ?? []) { total++; if (!voc.has(norm(e.word))) fuera++; }
    }
    console.log(`\n${hechas} construidas, ${saltadas} saltadas · ${fuera}/${total} ejercicios fuera del vocab de su historia`);
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
