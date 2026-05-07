// Simulates the /api/mobile/journey route locally for a given userId,
// using the production DATABASE_URL. Does NOT touch Clerk — instead,
// you can pass the placementLevel manually via --placement to test
// what the response would look like.

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env" });

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const userIdIdx = args.indexOf("--userId");
const userId = userIdIdx >= 0 ? args[userIdIdx + 1] : "user_33kGTw6oo7WW2spchkl7y52txtK";
const langIdx = args.indexOf("--language");
const language = langIdx >= 0 ? args[langIdx + 1] : "Italian";
const placementIdx = args.indexOf("--placement");
const placement = placementIdx >= 0 ? args[placementIdx + 1] : null;

const COMPLETE_RATIO = 0.95;

function isCompletedFromAudio(progressSec: number | undefined, audioDurationSec: number | undefined): boolean {
  if (typeof progressSec !== "number" || typeof audioDurationSec !== "number" || audioDurationSec <= 0) return false;
  return progressSec >= audioDurationSec * COMPLETE_RATIO;
}

async function main() {
  console.log(`User: ${userId}, Language: ${language}, Placement: ${placement ?? "(none)"}`);

  // 1) Build completedStoryKeys (mirror getCompletedJourneyStoryKeys)
  const metrics = await prisma.userMetric.findMany({
    where: { userId, eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { bookSlug: true, storySlug: true, eventType: true, value: true, metadata: true },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });
  const completedStoryKeys = new Set<string>();
  for (const row of metrics) {
    const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata as Record<string, unknown> : null;
    const progressKey =
      meta && typeof meta.progressKey === "string" && meta.progressKey.trim()
        ? meta.progressKey.trim()
        : row.bookSlug && row.bookSlug !== "polyglot"
          ? `${row.bookSlug}:${row.storySlug}`
          : null;
    if (!progressKey || completedStoryKeys.has(progressKey)) continue;
    if (row.eventType === "audio_complete") {
      completedStoryKeys.add(progressKey);
      continue;
    }
    if (meta && isCompletedFromAudio(meta.progressSec as number, meta.audioDurationSec as number)) {
      completedStoryKeys.add(progressKey);
    }
  }
  console.log(`completedStoryKeys (global): ${completedStoryKeys.size}`);

  // 2) Build passedCheckpointKeys
  const checkpointMetrics = await prisma.userMetric.findMany({
    where: {
      userId,
      eventType: { in: ["journey_topic_checkpoint_complete", "path_topic_checkpoint_complete", "atlas_topic_checkpoint_complete"] },
    },
    select: { metadata: true },
    take: 1000,
  });
  const passedCheckpointKeys = new Set<string>();
  for (const row of checkpointMetrics) {
    const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata as Record<string, unknown> : null;
    if (!meta) continue;
    const levelId = typeof meta.levelId === "string" ? meta.levelId : "";
    const topicSlug = typeof meta.topicSlug === "string" ? meta.topicSlug : "";
    const variantId = typeof meta.variantId === "string" && meta.variantId.trim() !== "" ? meta.variantId : undefined;
    if (!levelId || !topicSlug) continue;
    passedCheckpointKeys.add(`${variantId ?? "default"}:${levelId}:${topicSlug}`);
  }
  console.log(`passedCheckpointKeys: ${passedCheckpointKeys.size}`);
  for (const k of passedCheckpointKeys) console.log(`  ${k}`);

  // 3) Get italian journeys
  const journeys = await prisma.journey.findMany({
    where: { language: { equals: language, mode: "insensitive" }, status: { not: "archived" } },
    orderBy: { createdAt: "asc" },
    include: {
      stories: {
        where: { status: "published", NOT: [{ text: null }, { title: null }] },
        orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
      },
    },
  });
  console.log(`\nJourneys for ${language}: ${journeys.length}`);
  for (const j of journeys) {
    console.log(`  id=${j.id} name=${j.name} variant=${j.variant} stories=${j.stories.length} levels=${(j.levels ?? []).join(",")}`);
  }

  // 4) Compute hasProgressInThisLanguage
  const allLanguageProgressKeys = new Set<string>();
  for (const j of journeys) {
    for (const s of j.stories) {
      if (s.slug) allLanguageProgressKeys.add(`standalone:${s.slug}`);
    }
  }
  console.log(`\nLanguage story progressKeys: ${allLanguageProgressKeys.size}`);
  let hasProgress = false;
  for (const pk of allLanguageProgressKeys) {
    if (completedStoryKeys.has(pk)) { hasProgress = true; console.log(`  HIT: ${pk}`); }
  }
  console.log(`hasProgressInThisLanguage: ${hasProgress}`);

  // 5) Self-heal verdict
  if (placement && !hasProgress) {
    console.log(`\nSELF-HEAL would trigger: clear placement=${placement}`);
  } else if (placement) {
    console.log(`\nSELF-HEAL would NOT trigger (user has progress in language)`);
  } else {
    console.log(`\nNo placement set, nothing to heal`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
