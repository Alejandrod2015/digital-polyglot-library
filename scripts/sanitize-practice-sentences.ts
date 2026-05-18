// Backfill script: apply sanitizePracticeSentence to every row in
// dp_story_practice_exercises_v1 that matches the dirty trailing-quote
// pattern. Mirrors /api/studio/sanitize-practice-sentences but skips
// HTTP/auth so we can run it directly against the prod DB without
// needing a browser session.
//
//   pnpm tsx scripts/sanitize-practice-sentences.ts
//   npx tsx scripts/sanitize-practice-sentences.ts
//
// Idempotent. Re-running has no effect on already-clean rows.

import { prisma } from "../src/lib/prisma";
import {
  isDirtyPracticeSentence,
  sanitizePracticeSentence,
} from "../src/lib/sanitizePracticeSentence";

async function main() {
  const rows = await prisma.storyPracticeExercise.findMany({
    select: { id: true, sentence: true },
  });
  const dirty = rows.filter(
    (r) => r.sentence && isDirtyPracticeSentence(r.sentence),
  );
  console.log(`Scanned: ${rows.length}`);
  console.log(`Dirty:   ${dirty.length}`);

  if (dirty.length === 0) {
    console.log("Nothing to do. Exit.");
    return;
  }

  console.log("\nFirst 5 changes:");
  for (const r of dirty.slice(0, 5)) {
    console.log(`  ${r.id.slice(0, 10)}…`);
    console.log(`    before: ${JSON.stringify(r.sentence)}`);
    console.log(`    after:  ${JSON.stringify(sanitizePracticeSentence(r.sentence!))}`);
  }

  // Sequential updates (not a transaction) so a slow row doesn't take
  // down the whole batch. The sanitizer is idempotent, so a partial
  // run is safe to retry.
  let updated = 0;
  for (const r of dirty) {
    const next = sanitizePracticeSentence(r.sentence!);
    await prisma.storyPracticeExercise.update({
      where: { id: r.id },
      data: { sentence: next },
    });
    updated += 1;
    if (updated % 10 === 0) console.log(`  ${updated}/${dirty.length}…`);
  }
  console.log(`\nUpdated: ${updated}`);

  // Verify post-state.
  const rowsAfter = await prisma.storyPracticeExercise.findMany({
    select: { sentence: true },
  });
  const remaining = rowsAfter.filter(
    (r) => r.sentence && isDirtyPracticeSentence(r.sentence),
  ).length;
  console.log(`Remaining dirty after pass: ${remaining}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
