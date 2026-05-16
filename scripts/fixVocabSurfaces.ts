/**
 * Reads every published JourneyStory, finds vocab items whose `surface`
 * (or `word` when surface is absent) does NOT appear as a literal token
 * in `text`, and either reports or applies the heuristic fix.
 *
 * The fix preserves `word` (the lemma, used as the displayed/teached
 * form) and only adjusts `surface` to the conjugated form that lives in
 * the text. computePracticeAudioRanges uses `surface` first, so this
 * closes the no-match gap that drops practice items into HQ TTS fallback.
 *
 * Usage:
 *   tsx scripts/fixVocabSurfaces.ts list                    # report all mismatches
 *   tsx scripts/fixVocabSurfaces.ts list --journey <id>     # one journey
 *   tsx scripts/fixVocabSurfaces.ts apply --journey <id>    # apply suggestions for that journey
 *   tsx scripts/fixVocabSurfaces.ts apply --all             # apply across every journey (dangerous)
 *
 * Apply mode only touches items where the suggester returns a single
 * top candidate that the user can audit before re-run. Items with
 * `suggestion: null` (no plausible match) are skipped and listed for
 * manual triage.
 */
import { prisma } from "../src/lib/prisma";
import { validateVocabAgainstText, findCandidates } from "../src/lib/vocabSurfaceValidation";

type VocabItem = {
  word: string;
  surface?: string | null;
  definition?: string;
  type?: string | null;
  note?: string | null;
};

function parseVocab(raw: unknown): VocabItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => v && typeof v === "object") as VocabItem[];
}

async function listMismatches(journeyId?: string) {
  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      ...(journeyId ? { journeyId } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      text: true,
      vocab: true,
      journey: { select: { id: true, language: true, variant: true } },
    },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  let totalIssues = 0;
  let totalUnfixable = 0;
  for (const story of stories) {
    if (!story.text) continue;
    const vocab = parseVocab(story.vocab);
    const check = validateVocabAgainstText(vocab, story.text);
    if (check.ok) continue;
    console.log(`\n=== ${story.journey.language}-${story.journey.variant} | ${story.slug}  (${story.id}) ===`);
    for (const issue of check.issues) {
      totalIssues += 1;
      if (!issue.suggestion) totalUnfixable += 1;
      const cand = issue.candidates.length > 0 ? `  candidates: ${issue.candidates.join(", ")}` : "";
      console.log(
        `  word="${issue.word}" surface="${issue.declaredSurface}" → suggest "${issue.suggestion ?? "??"}"${cand}`,
      );
    }
  }
  console.log(`\nTotal mismatches: ${totalIssues}, unfixable by heuristic: ${totalUnfixable}`);
}

async function applyFixes(journeyId: string | null, force: boolean) {
  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      ...(journeyId ? { journeyId } : {}),
    },
    select: {
      id: true,
      slug: true,
      text: true,
      vocab: true,
      journey: { select: { language: true, variant: true } },
    },
  });

  let fixed = 0;
  let skipped = 0;
  for (const story of stories) {
    if (!story.text) continue;
    const vocab = parseVocab(story.vocab);
    const check = validateVocabAgainstText(vocab, story.text);
    if (check.ok) continue;

    const updated: VocabItem[] = vocab.map((item) => {
      const declared = (item.surface && item.surface.trim()) || item.word;
      const { suggestion, confidence } = findCandidates(declared, story.text!);
      if (!suggestion) return item;
      // Unicode-aware: same regex as the validator so we don't try to
      // "fix" items that already match the text correctly.
      const escaped = declared.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "iu");
      if (pattern.test(story.text!)) return item;
      // Only auto-apply high-confidence suggestions. Low-confidence ones
      // need editorial review (the suggested token may be unrelated).
      if (confidence !== "high" && !force) return item;
      return { ...item, surface: suggestion };
    });

    // Apply partial fixes: don't skip the whole story if some items
    // can't be heuristically corrected. The remaining ones get flagged
    // by `list` for manual editorial review.
    const dirty = updated.some(
      (after, i) => (after.surface ?? null) !== (vocab[i].surface ?? null),
    );
    if (!dirty) {
      skipped += 1;
      continue;
    }

    await prisma.journeyStory.update({
      where: { id: story.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { vocab: updated as any },
    });
    console.log(`FIXED ${story.slug} (${story.journey.language}-${story.journey.variant})`);
    fixed += 1;
  }
  console.log(`\nFixed ${fixed} stories, skipped ${skipped}.`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const journeyArgIdx = args.indexOf("--journey");
  const journeyId = journeyArgIdx >= 0 ? args[journeyArgIdx + 1] : null;
  const all = args.includes("--all");
  const force = args.includes("--force");

  if (cmd === "list") {
    await listMismatches(journeyId ?? undefined);
  } else if (cmd === "apply") {
    if (!journeyId && !all) {
      console.error("Pass --journey <id> or --all");
      process.exit(2);
    }
    await applyFixes(journeyId, force);
  } else {
    console.error("Usage: tsx scripts/fixVocabSurfaces.ts list [--journey <id>]");
    console.error("       tsx scripts/fixVocabSurfaces.ts apply --journey <id> [--force]");
    console.error("       tsx scripts/fixVocabSurfaces.ts apply --all [--force]");
    process.exit(2);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
