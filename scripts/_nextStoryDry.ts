import { runNextStoryPush, type NextStorySkipReason } from "../src/lib/nextStoryPush";

async function main() {
  const report = await runNextStoryPush({ dryRun: true });
  const skipped: Partial<Record<NextStorySkipReason, number>> = {};
  for (const c of report.candidates) if (c.skip) skipped[c.skip] = (skipped[c.skip] ?? 0) + 1;
  console.log("finales mirados (21d):", report.rows, "| APNs:", report.apnsConfigured);
  console.log("descartes:", skipped);
  console.log("elegibles:", report.candidates.filter((c) => c.eligible).length);
  console.log("\ntextos que saldrian (uno por cada caso, aunque se descarten):");
  const seen = new Set<string>();
  for (const c of report.candidates) {
    if (!c.toSlug) continue;
    const k = `${c.newTopic}:${c.leftInTopic}`;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  [${c.skip ?? (c.tokenCount ? "ELEGIBLE" : "sin resolver: Clerk local es sk_test")}] hace ${c.hoursSince}h | ${c.journeyLabel}`);
    console.log(`     de "${c.fromTitle}" -> "${c.toTitle}"`);
    console.log(`     "${c.title}" / "${c.body}"`);
  }
  console.log("\nerrores (los de Clerk son la clave sk_test local):", report.errors.length);
}
main().finally(() => process.exit(0));
