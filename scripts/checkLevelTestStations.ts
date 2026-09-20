/**
 * Checks the level test against the live catalogue: every rung of both
 * Spanish variants has at least one live story with four usable curated
 * exercises (listen with its clip, meaning, context, fill-the-gap), and
 * prints one table per variant with the stories and formats each station
 * serves, to read the ladder as the learner will get it.
 *
 *   npx tsx scripts/checkLevelTestStations.ts
 *
 * Exits 1 when a rung has no station. Nothing is authored by hand: if a
 * rung goes red, the fix is a curated set with audio for a story of that
 * level, not an edit here.
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

async function main() {
  // Imported here, after the cache trick above, because `@/lib/prisma`
  // seals itself with `server-only` and static imports are hoisted.
  const { buildLevelTest } = await import("../src/lib/levelTest/buildLevelTest");
  let failed = false;
  for (const variant of ["latam", "spain"]) {
    const built = await buildLevelTest("Spanish", variant);
    if (!built) throw new Error("Spanish has no level test");
    console.log(`\n## Spanish / ${variant}: ladder ${built.payload.ladder.join(" > ")}`);
    console.log("| rung | story | formats |");
    console.log("| --- | --- | --- |");
    for (const s of built.payload.stations) {
      const formats = s.exercises.map((e) => String(e.type).replace("_", " ")).join(", ");
      console.log(`| ${s.level} | ${s.story.slug} | ${formats} |`);
    }
    for (const p of built.problems) {
      console.log(`PROBLEM ${variant}/${p.level}: ${p.reason}`);
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
