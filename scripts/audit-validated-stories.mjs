// Quick audit: shows what the worker has validated/staged so far.
// Reads JourneyStory rows from prod Neon (per .env DATABASE_URL).
// Groups by (language, level, topic, slug, title) to surface dupes and
// gives a per-status summary.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const stories = await prisma.journeyStory.findMany({
    where: { journey: { status: { not: "archived" } } },
    orderBy: [
      { journey: { createdAt: "asc" } },
      { level: "asc" },
      { slotIndex: "asc" },
    ],
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      topic: true,
      slotIndex: true,
      status: true,
      arcType: true,
      coverDone: true,
      coverUrl: true,
      audioUrl: true,
      audioStatus: true,
      journeyId: true,
      createdAt: true,
      updatedAt: true,
      journey: { select: { name: true, language: true, variant: true } },
    },
  });

  console.log(`\n=== Total JourneyStory rows: ${stories.length} ===\n`);

  // Status breakdown
  const byStatus = stories.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Status breakdown:");
  for (const [k, v] of Object.entries(byStatus)) {
    console.log(`  ${k}: ${v}`);
  }

  // Audio + cover completeness for qa_pass / approved / published
  const ready = stories.filter((s) =>
    ["qa_pass", "approved", "published"].includes(s.status),
  );
  const missingCover = ready.filter((s) => !s.coverDone || !s.coverUrl);
  const missingAudio = ready.filter(
    (s) => !s.audioUrl || s.audioStatus !== "ready",
  );
  console.log(`\nReady-tier stories (qa_pass/approved/published): ${ready.length}`);
  console.log(`  Missing cover: ${missingCover.length}`);
  console.log(`  Missing audio: ${missingAudio.length}`);

  // Dedupe check: same slug appearing more than once
  const slugCounts = new Map();
  for (const s of stories) {
    slugCounts.set(s.slug, (slugCounts.get(s.slug) ?? 0) + 1);
  }
  const dupeSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1);
  console.log(`\nDuplicate slug count: ${dupeSlugs.length}`);
  for (const [slug, n] of dupeSlugs) {
    console.log(`  ${slug}  (${n} rows)`);
  }

  // Same title within same journey + same arcType — soft dup signal
  const softKey = (s) =>
    `${s.journeyId}::${(s.title ?? "").toLowerCase()}::${s.arcType ?? ""}`;
  const softCounts = new Map();
  for (const s of stories) {
    const k = softKey(s);
    if (!softCounts.has(k)) softCounts.set(k, []);
    softCounts.get(k).push(s);
  }
  const softDupes = [...softCounts.entries()].filter(([, arr]) => arr.length > 1);
  console.log(
    `\nSoft duplicates (same journey + same title + same arcType): ${softDupes.length}`,
  );
  for (const [k, arr] of softDupes) {
    console.log(`  ${k}`);
    for (const row of arr) {
      console.log(
        `    - ${row.slug}  level=${row.level}  slot=${row.slotIndex}  status=${row.status}  topic=${row.topic ?? "—"}  created=${row.createdAt.toISOString().slice(0, 10)}`,
      );
    }
  }

  // Group by journey to print "inventory"
  const byJourney = new Map();
  for (const s of stories) {
    const jId = s.journeyId;
    if (!byJourney.has(jId)) byJourney.set(jId, []);
    byJourney.get(jId).push(s);
  }
  console.log(`\n=== Per-journey inventory (${byJourney.size} journeys) ===`);
  for (const [, arr] of byJourney) {
    const j = arr[0].journey;
    console.log(`\n  ${j.name}  [${j.language} / ${j.variant ?? "—"}]  · ${arr.length} stories`);
    const levelGroups = arr.reduce((acc, s) => {
      acc[s.level] = (acc[s.level] ?? []).concat(s);
      return acc;
    }, {});
    for (const [lvl, list] of Object.entries(levelGroups)) {
      const titles = list
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map(
          (s) =>
            `${s.slotIndex}.${s.title}${s.status === "qa_pass" ? "" : ` [${s.status}]`}`,
        )
        .join(" · ");
      console.log(`    ${lvl}:  ${titles}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
