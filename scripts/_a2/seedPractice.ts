/**
 * Construye el set de practica de las 21 historias de UN journey, aunque esten
 * en draft.
 *
 * `scripts/seedStoryPracticeSets.ts` filtra `status: "published"`, asi que no
 * toca un journey en borrador. Aqui se selecciona por `journeyId` y se delega
 * en el MISMO constructor canonico (`buildAndPersistStoryPracticeSet`), que
 * escribe `audioUrl: null`: no gasta un solo credito de TTS. Los clips son un
 * paso aparte, con su gate F0.
 *
 * `src/lib/prisma` importa `server-only` y los `import` se izan por encima del
 * shim, asi que prisma y el constructor se cargan con `createRequire` DESPUES
 * de neutralizar el guard.
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

const { prisma } = req("../../src/lib/prisma") as typeof import("../../src/lib/prisma");
const { buildAndPersistStoryPracticeSet } =
  req("../../src/lib/storyPracticeSets") as typeof import("../../src/lib/storyPracticeSets");

(async () => {
  const journeyId = process.argv[2];
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");
  if (!journeyId) { console.error("uso: seedPractice.ts <journeyId> [--force] [--dry]"); process.exit(2); }

  const j = await prisma.journey.findUnique({ where: { id: journeyId } });
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, text: { not: null } },
    select: { id: true, slug: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  const a = j as unknown as Record<string, unknown>;
  console.log(`${a.name}/${a.language}/${a.variant} ${JSON.stringify(a.levels)} · ${stories.length} historias con texto\n`);
  if (dry) { for (const s of stories) console.log(`  ${s.slug}`); return; }

  const cuenta: Record<string, number> = {};
  for (const s of stories) {
    const r = await buildAndPersistStoryPracticeSet(s.id, force);
    const k = r.status === "skipped" ? `skipped:${(r as { reason?: string }).reason}` : r.status;
    cuenta[k] = (cuenta[k] ?? 0) + 1;
    console.log(`  ${String(s.slug).padEnd(32)} ${k}`);
  }
  console.log(`\n${Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
})().catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { const { prisma: p } = req("../../src/lib/prisma") as typeof import("../../src/lib/prisma"); await p.$disconnect(); });
