/**
 * checkJourneySlotCounts.ts; hard invariant guard for the published journey
 * corpus. Fails (exit 1) if any topic of any ACTIVE journey does not have
 * exactly 3 published stories. This is the guard that would have caught the
 * A1 LATAM "23 instead of 21" drift (two topics silently grew a 4th slot).
 *
 * Run manually, in CI, or from a pre-push hook:
 *   npx tsx scripts/checkJourneySlotCounts.ts
 *   npx tsx scripts/checkJourneySlotCounts.ts 3   # explicit expected slots
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { checkActiveJourneySlotCounts, DEFAULT_SLOTS_PER_TOPIC } from "../src/lib/journeyInvariants";

async function main() {
  const expected = Number(process.argv[2] ?? DEFAULT_SLOTS_PER_TOPIC);
  const prisma = new PrismaClient();
  const violations = await checkActiveJourneySlotCounts(prisma, expected);
  await prisma.$disconnect();

  if (violations.length === 0) {
    console.log(`✓ Every topic in every active journey has exactly ${expected} published stories.`);
    return;
  }

  console.error(`✗ ${violations.length} slot-count violation(s) (expected ${expected} published per topic):`);
  for (const v of violations) {
    console.error(
      `  ${v.language}/${v.variant} · ${v.level} · ${v.topic}: ${v.actual} published ` +
      `(expected ${v.expected})  [journey "${v.journeyName}"]`
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
