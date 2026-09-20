/**
 * Checks every authored station of the listening level test against the
 * live catalogue: story live with audio, fragment indexes present, vocab
 * word in the clip and in the story's glosses, three distractors
 * available. Prints one table per variant with the clip length and text,
 * so the stations can be read as the learner will hear them.
 *
 *   npx tsx scripts/checkLevelTestStations.ts
 *
 * Exits 1 on any problem. Run it after editing
 * `src/lib/levelTest/stations.es.ts` and before shipping.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// `server-only` throws outside Next; the prisma helper imports it.
import { createRequire } from "module";
const req = createRequire(__filename);
try {
  const q = req.resolve("server-only");
  (req as unknown as { cache: Record<string, unknown> }).cache[q] = {
    id: q, filename: q, loaded: true, exports: {},
  };
} catch {}

import { SPANISH_LEVEL_TEST } from "../src/lib/levelTest/stations.es";

async function main() {
  // Imported here, after the cache trick above, because `@/lib/prisma`
  // seals itself with `server-only` and static imports are hoisted.
  const { buildLevelTest } = await import("../src/lib/levelTest/buildLevelTest");
  let failed = false;
  for (const variant of Object.keys(SPANISH_LEVEL_TEST)) {
    const built = await buildLevelTest("Spanish", variant);
    if (!built) throw new Error("Spanish has no level test");
    const authored = SPANISH_LEVEL_TEST[variant as keyof typeof SPANISH_LEVEL_TEST];
    console.log(`\n## Spanish / ${variant}: ladder ${built.payload.ladder.join(" > ")}`);
    console.log("| rung | station | story | clip | s | vocab | answer |");
    console.log("| --- | --- | --- | --- | --- | --- | --- |");
    for (const s of built.payload.stations) {
      const seconds = s.clips.reduce((a, c) => a + c.durationSec, 0).toFixed(0);
      const text = s.clips.map((c) => c.text).join(" ");
      console.log(
        `| ${s.level} | ${s.id} | ${s.story.slug} | ${text.replace(/\|/g, "/")} | ${seconds} | ${s.vocab.word} | ${s.comprehension.options[s.comprehension.answerIndex]} |`
      );
      if (s.vocab.answerIndex < 0) {
        console.log(`  PROBLEM ${s.id}: vocab answer not among options`);
        failed = true;
      }
    }
    for (const p of built.problems) {
      console.log(`PROBLEM ${p.stationId}: ${p.reason}`);
      failed = true;
    }
    for (const level of authored.ladder) {
      const n = built.payload.stations.filter((s) => s.level === level).length;
      if (n < 2) {
        console.log(`PROBLEM ${variant}/${level}: ${n} station(s), need 2`);
        failed = true;
      }
    }
    const missing = authored.ladder.filter((l) => !built.payload.ladder.includes(l));
    if (missing.length) {
      console.log(`PROBLEM ${variant}: rungs without any station: ${missing.join(", ")}`);
      failed = true;
    }
  }
  if (failed) {
    console.log("\nlevel-test stations: PROBLEMS FOUND");
    process.exit(1);
  }
  console.log("\nlevel-test stations: ok");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
