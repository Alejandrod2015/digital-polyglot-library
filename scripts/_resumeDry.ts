import { runResumeStoryPush } from "../src/lib/resumeStoryPush";

async function main() {
  const report = await runResumeStoryPush({ dryRun: true });
  const skipped: Record<string, number> = {};
  for (const c of report.candidates) if (c.skip) skipped[c.skip] = (skipped[c.skip] ?? 0) + 1;
  console.log("filas en ventana:", report.rows, "| APNs:", report.apnsConfigured);
  console.log("descartes:", skipped);
  const eligible = report.candidates.filter((c) => c.eligible);
  console.log("elegibles:", eligible.length);
  for (const c of eligible.slice(0, 10)) {
    console.log(`  ${c.userId.slice(0, 12)}... ${c.storySlug} ${Math.round(c.ratio * 100)}% hace ${c.hoursSince}h`);
    console.log(`     "${c.title}" / "${c.body}"`);
  }
  console.log("\nmuestra de textos de los que SI resuelven historia (aunque se descarten):");
  for (const c of report.candidates.filter((c) => c.storyTitle).slice(0, 8)) {
    console.log(`  [${c.skip ?? "elegible"}] "${c.title}" / "${c.body}"`);
  }
  console.log("errores:", report.errors.slice(0, 5));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
