import { config } from "dotenv";
import {
  buildJourneyVariants,
  buildJourneyTrackInsights,
} from "../src/app/journey/journeyData";
import {
  getCompletedJourneyStoryKeys,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
  getJourneyDueReviewItems,
} from "../src/lib/journeyProgress";
import { getJourneyTopicCompletedStoryCount, getUnlockedLevelCount, getJourneyPlacementLevelIndex } from "../src/lib/journeyCurriculumSource";
import { createClerkClient } from "@clerk/backend";

config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const userId = process.argv[2];
  const language = process.argv[3] ?? "Italian";
  if (!userId) { console.error("Usage: tsx scripts/simulateMobileJourneyForUser.ts <userId> [Italian]"); process.exit(1); }

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  let user;
  try { user = await clerk.users.getUser(userId); } catch { console.error("user not found"); process.exit(1); }
  const placementLevel = (user.publicMetadata as any)?.journeyPlacementLevel ?? null;
  console.log(`User ${userId} | placementLevel=${placementLevel ?? "(none)"}`);

  const [tracks, completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] =
    await Promise.all([
      buildJourneyVariants(language, "General"),
      getCompletedJourneyStoryKeys(userId),
      getPassedJourneyCheckpointKeys(userId),
      getPracticedJourneyTopicKeys(userId),
      getJourneyDueReviewItems(200, userId),
    ]);

  console.log(`Tracks for ${language}: ${tracks.length}`);
  console.log(`completedStoryKeys size: ${completedStoryKeys.size}`);
  if (completedStoryKeys.size > 0) {
    for (const k of completedStoryKeys) console.log(`  completed key: ${k}`);
  }

  for (const track of tracks) {
    const placementLevelIndex = getJourneyPlacementLevelIndex(track.levels, placementLevel);
    const baseUnlockedLevelCount = getUnlockedLevelCount(track.levels, completedStoryKeys, passedCheckpointKeys, track.id);
    const unlockedLevelCount = placementLevelIndex >= 0
      ? Math.max(baseUnlockedLevelCount, Math.min(track.levels.length, placementLevelIndex + 1))
      : baseUnlockedLevelCount;
    console.log(`Track ${track.id}: ${track.levels.length} levels, unlockedLevels=${unlockedLevelCount}, placementLevelIdx=${placementLevelIndex}`);

    let nextFound = false;
    track.levels.forEach((level, levelIndex) => {
      const unlocked = levelIndex < unlockedLevelCount;
      level.topics.forEach((topic) => {
        const completedCount = getJourneyTopicCompletedStoryCount(topic, completedStoryKeys);
        const requiredCount = Math.max(1, Math.ceil(topic.stories.length * 0.75));
        const unlockedStoryCount = unlocked ? topic.stories.length : 0;
        topic.stories.forEach((story: any, storyIndex: number) => {
          const audioFinished = completedStoryKeys.has(story.progressKey);
          const skipped = placementLevelIndex >= 0 && levelIndex < placementLevelIndex;
          const storyUnlocked = unlocked && storyIndex < unlockedStoryCount;
          const isNext = !nextFound && storyUnlocked && !audioFinished && !skipped;
          if (isNext) {
            nextFound = true;
            console.log(`  >>> NEXT: level=${level.id} topic=${topic.slug} story[${storyIndex}]=${story.title}`);
            console.log(`      progressKey=${story.progressKey} unlocked=${storyUnlocked} audioFinished=${audioFinished} skipped=${skipped}`);
          } else if (audioFinished) {
            console.log(`  audioFinished: level=${level.id} topic=${topic.slug} idx=${storyIndex} ${story.title}`);
          }
        });
      });
    });
    if (!nextFound) console.log("  >>> NO NEXT (all completed/skipped/locked)");
  }
}
run().catch(e => { console.error(e); process.exit(1); });
