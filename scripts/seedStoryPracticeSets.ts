/**
 * Build and persist a 10-exercise practice set for every published
 * JourneyStory that has vocab. Delegates to the shared helper
 * `buildAndPersistStoryPracticeSet`, which also pre-renders each
 * exercise's audio with the story's voice + 150 ms tail silence.
 *
 *   tsx scripts/seedStoryPracticeSets.ts                # only new
 *   tsx scripts/seedStoryPracticeSets.ts --force        # overwrite unlocked
 *   tsx scripts/seedStoryPracticeSets.ts --story <slug> # one story
 *   tsx scripts/seedStoryPracticeSets.ts --dry-run      # plan, do not write
 *
 * Locked sets (locked=true) are never overwritten.
 */
import { prisma } from "../src/lib/prisma";
import { buildAndPersistStoryPracticeSet } from "../src/lib/storyPracticeSets";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const slugIdx = args.indexOf("--story");
  const singleSlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      text: { not: null },
      ...(singleSlug ? { slug: singleSlug } : {}),
    },
    select: { id: true, slug: true, title: true },
    orderBy: [{ journeyId: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`Found ${stories.length} published stories. force=${force} dryRun=${dryRun}\n`);

  if (dryRun) {
    for (const s of stories) console.log(` - ${s.slug} | ${s.title?.slice(0, 60)}`);
    return;
  }

  const stats = { created: 0, updated: 0, skipped: 0, locked: 0, noVocab: 0, notFound: 0 };

  for (const s of stories) {
    process.stdout.write(`${s.slug?.padEnd(40) ?? "?"} `);
    try {
      const r = await buildAndPersistStoryPracticeSet(s.id, force);
      switch (r.status) {
        case "created": stats.created += 1; console.log(`✓ created (${r.count})`); break;
        case "updated": stats.updated += 1; console.log(`✓ updated (${r.count})`); break;
        case "skipped":
          if (r.reason === "exists") { stats.skipped += 1; console.log(`· skipped (exists, use --force)`); }
          else if (r.reason === "locked") { stats.locked += 1; console.log(`· locked (editor-approved)`); }
          else if (r.reason === "no-vocab") { stats.noVocab += 1; console.log(`× skipped (no vocab)`); }
          else { stats.notFound += 1; console.log(`× skipped (not found)`); }
          break;
      }
    } catch (err) {
      console.log(`✗ FAIL: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} locked=${stats.locked} no-vocab=${stats.noVocab} not-found=${stats.notFound}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
