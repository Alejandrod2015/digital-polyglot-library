// Pure (server-safe) journey insight builders.
//
// Vive separado de `journeyData.ts` porque ese archivo importa
// `@/lib/prisma` y se usa desde server components. Cuando un client
// component (e.g. `JourneyClient.tsx`) importa una función runtime
// de `journeyData.ts`, webpack bundlea TODA la cadena transitiva al
// cliente — incluyendo `prisma`, que peta en browser con
// "PrismaClient is unable to run in this browser environment".
//
// La regla: cualquier función *pura* que necesita un client component
// vive acá. Funciones que tocan DB (prisma.findMany, etc.) viven en
// journeyData.ts. Los tipos pueden estar en cualquiera porque
// `import type` se borra en compile-time.

import {
  getJourneyTopicCheckpointKey,
  getJourneyTopicCompletedStoryCount,
  getJourneyTopicRequiredStoryCount,
} from "@/lib/journeyUnlock";
import type {
  JourneyReviewLaneTopic,
  JourneyTrackInsights,
  JourneyVariantTrack,
} from "./journeyData";

export function getJourneyTopicPracticeKey(
  variantId: string | undefined,
  levelId: string,
  topicSlug: string
): string {
  return `${variantId ?? "default"}:${levelId}:${topicSlug}`;
}

export function buildJourneyTrackInsights(
  track: Pick<JourneyVariantTrack, "id" | "levels">,
  completedStoryKeys: Set<string>,
  practicedTopicKeys: Set<string>,
  passedCheckpointKeys: Set<string>,
  dueReviewItems: Array<{ progressKey: string | null }>
): JourneyTrackInsights {
  const dueReviewProgressKeySet = new Set(
    dueReviewItems
      .map((item) => item.progressKey)
      .filter((value): value is string => Boolean(value))
  );

  let completedRequiredStories = 0;
  let totalRequiredStories = 0;
  let practicedTopicCount = 0;
  let totalTopicCount = 0;
  let passedCheckpointCount = 0;
  let dueReviewCount = 0;
  let currentLevelId: string | null = null;
  let currentLevelTitle: string | null = null;
  let nextMilestone = "Journey cleared";
  const reviewTopics: JourneyReviewLaneTopic[] = [];

  for (const level of track.levels) {
    let levelHasAnyStory = false;
    let levelHasAnyProgress = false;

    for (const topic of level.topics) {
      if (topic.storyCount <= 0) continue;

      levelHasAnyStory = true;
      totalTopicCount += 1;
      const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
      const completedStoryCount = getJourneyTopicCompletedStoryCount(topic, completedStoryKeys);
      const completedRequiredCount = Math.min(completedStoryCount, requiredStoryCount);
      const practiceKey = getJourneyTopicPracticeKey(track.id, level.id, topic.slug);
      const checkpointKey = getJourneyTopicCheckpointKey(track.id, level.id, topic.slug);
      const practiced = practicedTopicKeys.has(practiceKey);
      const checkpointPassed = passedCheckpointKeys.has(checkpointKey);
      const complete = requiredStoryCount > 0 && completedStoryCount >= requiredStoryCount;
      const topicDueCount = topic.stories.reduce((sum, story) => {
        return sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0);
      }, 0);

      totalRequiredStories += requiredStoryCount;
      completedRequiredStories += completedRequiredCount;
      if (practiced) practicedTopicCount += 1;
      if (checkpointPassed) passedCheckpointCount += 1;
      dueReviewCount += topicDueCount;

      if (completedRequiredCount > 0 || practiced || checkpointPassed || topicDueCount > 0) {
        levelHasAnyProgress = true;
      }

      if (topicDueCount > 0) {
        reviewTopics.push({
          levelId: level.id,
          levelTitle: level.title,
          topicSlug: topic.slug,
          topicLabel: topic.label,
          dueCount: topicDueCount,
          complete,
          practiced,
          checkpointPassed,
        });
      }

      if (nextMilestone === "Journey cleared") {
        if (!complete) {
          const remaining = Math.max(requiredStoryCount - completedStoryCount, 0);
          nextMilestone = `Complete ${remaining} more ${remaining === 1 ? "story" : "stories"} in ${topic.label}`;
        } else if (!practiced) {
          nextMilestone = `Practice ${topic.label}`;
        } else if (!checkpointPassed) {
          nextMilestone = `Clear the ${topic.label} checkpoint`;
        }
      }
    }

    if (!currentLevelId && levelHasAnyStory && levelHasAnyProgress) {
      currentLevelId = level.id;
      currentLevelTitle = level.title;
    }
  }

  if (!currentLevelId) {
    const firstLevelWithStories = track.levels.find((level) =>
      level.topics.some((topic) => topic.storyCount > 0)
    );
    currentLevelId = firstLevelWithStories?.id ?? null;
    currentLevelTitle = firstLevelWithStories?.title ?? null;
  }

  reviewTopics.sort((a, b) => b.dueCount - a.dueCount || a.topicLabel.localeCompare(b.topicLabel));

  const totalCheckpointCount = totalTopicCount;
  const totalSteps = totalRequiredStories + totalTopicCount + totalCheckpointCount;
  const completedSteps = completedRequiredStories + practicedTopicCount + passedCheckpointCount;

  return {
    score: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    completedSteps,
    totalSteps,
    completedRequiredStories,
    totalRequiredStories,
    practicedTopicCount,
    totalTopicCount,
    passedCheckpointCount,
    totalCheckpointCount,
    dueReviewCount,
    dueTopicCount: reviewTopics.length,
    reviewTopics,
    currentLevelId,
    currentLevelTitle,
    nextMilestone,
  };
}
