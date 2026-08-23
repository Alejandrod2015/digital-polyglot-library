/**
 * Reconstruye los sets de practica del Traveler DE A0 contra el texto nuevo.
 *
 * POR QUE UN LANZADOR PROPIO: `seedStoryPracticeSets.ts` filtra
 * `status: "published"` y este journey esta en draft, y `_rebuildPracticeSet.ts`
 * importa `@/lib/storyPracticeSets` arriba del todo, asi que el `server-only`
 * de `src/lib/prisma` revienta antes de que nada pueda neutralizarlo (los
 * `import` se izan). Aqui el guard se anula ANTES y el constructor canonico se
 * carga con `createRequire`; la logica de construccion no se duplica.
 *
 *   npx tsx scripts/_deRebuildPractice.ts [--dry]
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

import { PrismaClient } from "../src/generated/prisma";

const JID = "cmt0a8vb1000m32p1x7r5ba28";
const prisma = new PrismaClient();

(async () => {
  const dry = process.argv.includes("--dry");
  const { buildAndPersistStoryPracticeSet } =
    req("./../src/lib/storyPracticeSets") as typeof import("../src/lib/storyPracticeSets");

  const j = await prisma.journey.findUnique({ where: { id: JID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await prisma.journeyStory.findMany({
    where: { journeyId: JID, NOT: { text: null } },
    select: { id: true, slug: true, topic: true, slotIndex: true, practiceSet: { select: { locked: true } } },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  for (const s of st) {
    if (s.practiceSet?.locked) { console.log(`${s.slug}: locked, no se toca`); continue; }
    if (dry) { console.log(`${s.slug}: se reconstruiria`); continue; }
    const r = await buildAndPersistStoryPracticeSet(s.id, true);
    console.log(`${(s.slug ?? "").padEnd(40)} ${r.status}${"count" in r ? ` (${r.count})` : ` ${r.reason}`}`);
  }
  await prisma.$disconnect();
})();
