/**
 * Re-validate every JourneyStory currently in `qa_pass` against the
 * latest `validateGeneratedStory` rules. Stories that no longer pass are
 * demoted to `needs_review` so the worker sees them as pending fixes.
 *
 * Why this exists: status `qa_pass` is set at staging time. When we
 * tighten the validator (e.g. stricter vocab-level-frequency, expanded
 * curated lists, or LLM cache changes), previously-passing stories can
 * stop passing. Without a re-validation pass, `qa_pass` becomes a stale
 * flag that no longer matches what the validator actually checks today.
 *
 * Usage:
 *   npx tsx --conditions=react-server scripts/revalidate-qa-pass.ts          # dry-run
 *   npx tsx --conditions=react-server scripts/revalidate-qa-pass.ts --apply  # demote failures
 *
 * The `react-server` condition is required because the validator pulls
 * in `server-only` modules.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import { validateGeneratedStory } from "../src/lib/validateGeneratedStory";

const apply = process.argv.includes("--apply");

const LANG_MAP: Record<string, string> = {
  spanish: "es",
  german: "de",
  italian: "it",
};

async function main() {
  const prisma = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { status: "qa_pass" },
    include: { journey: { select: { name: true, language: true, variant: true } } },
    orderBy: [{ journeyId: "asc" }, { level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  // Preload journey-wide title sets for the anchor-repetition and
  // template-monotony checks (otherwise the validator would skip them).
  const journeyTitleMap = new Map<string, string[]>();
  const allTitleRows = await prisma.journeyStory.findMany({
    where: { title: { not: null } },
    select: { journeyId: true, title: true },
  });
  for (const r of allTitleRows) {
    if (!journeyTitleMap.has(r.journeyId)) journeyTitleMap.set(r.journeyId, []);
    journeyTitleMap.get(r.journeyId)!.push(r.title!);
  }

  type Demote = { id: string; bucket: string; slot: number; title: string; fails: string[] };
  const toDemote: Demote[] = [];
  let pass = 0;

  for (const s of stories) {
    const j: { name: string; language: string; variant?: string } = (
      s as unknown as { journey: { name: string; language: string; variant?: string } }
    ).journey;
    const langCode = LANG_MAP[j.language] ?? "";
    const result = await validateGeneratedStory(
      {
        title: s.title ?? "",
        synopsis: s.synopsis ?? "",
        arcType: s.arcType ?? "late-reveal",
        text: s.text ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vocab: (s.vocab as any[]) ?? [],
      },
      {
        language: langCode,
        level: s.level,
        topic: s.topic,
        variant: j.variant,
        journeyTitles: (
          journeyTitleMap.get(
            (s as unknown as { journeyId: string }).journeyId
          ) ?? []
        ).filter((t) => t !== s.title),
      }
    );
    const fails = result.checks.filter((c) => c.status === "fail");
    if (fails.length === 0) {
      pass++;
      continue;
    }
    toDemote.push({
      id: s.id,
      bucket: `${j.language} · ${s.level} · ${s.topic}`,
      slot: s.slotIndex,
      title: s.title ?? "(no title)",
      fails: fails.map((f) => `${f.id}: ${f.detail ?? f.label}`),
    });
  }

  console.log(`Re-validated ${stories.length} qa_pass stories.`);
  console.log(`  ${pass} still pass.`);
  console.log(`  ${toDemote.length} now fail.\n`);

  for (const d of toDemote) {
    console.log(`  - [${d.bucket} · slot ${d.slot}] ${d.title}`);
    for (const f of d.fails) console.log(`      ${f}`);
  }

  if (!apply) {
    console.log("\nDry-run. Pass --apply to demote the failing ones to needs_review.");
    await prisma.$disconnect();
    return;
  }

  if (toDemote.length === 0) {
    console.log("\nNothing to demote. All qa_pass stories still pass.");
    await prisma.$disconnect();
    return;
  }

  const ids = toDemote.map((d) => d.id);
  const updated = await prisma.journeyStory.updateMany({
    where: { id: { in: ids } },
    data: { status: "needs_review" },
  });
  console.log(`\nDemoted ${updated.count} stories from qa_pass → needs_review.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
