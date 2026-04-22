// Standalone port of buildJourneyTrackInsights for the mobile app. Keeps
// mobile independent of the web source tree. Shapes match what the mobile
// API returns for track.insights so we can use this as a client-side
// fallback.

type JourneyStory = {
  progressKey: string;
};

type JourneyTopic = {
  id: string;
  slug: string;
  label: string;
  storyCount: number;
  storyTarget?: number;
  stories: JourneyStory[];
};

type JourneyLevel = {
  id: string;
  title: string;
  subtitle: string;
  topics: JourneyTopic[];
};

type JourneyTrack = {
  id: string;
  levels: JourneyLevel[];
};

export type JourneyReviewLaneTopic = {
  levelId: string;
  levelTitle: string;
  topicSlug: string;
  topicLabel: string;
  dueCount: number;
  complete: boolean;
  practiced: boolean;
  checkpointPassed: boolean;
};

export type JourneyTrackInsights = {
  score: number;
  completedSteps: number;
  totalSteps: number;
  completedRequiredStories: number;
  totalRequiredStories: number;
  practicedTopicCount: number;
  totalTopicCount: number;
  passedCheckpointCount: number;
  totalCheckpointCount: number;
  dueReviewCount: number;
  dueTopicCount: number;
  reviewTopics: JourneyReviewLaneTopic[];
  currentLevelId: string | null;
  currentLevelTitle: string | null;
  nextMilestone: string;
};

function getRequiredStoryCount(topic: JourneyTopic): number {
  if (topic.stories.length === 0) return 0;
  if (typeof topic.storyTarget === "number" && Number.isFinite(topic.storyTarget)) {
    return Math.max(1, Math.min(topic.storyTarget, topic.stories.length));
  }
  return topic.stories.length;
}

function getCompletedStoryCount(topic: JourneyTopic, completedStoryKeys: Set<string>): number {
  return topic.stories.filter((story) => completedStoryKeys.has(story.progressKey)).length;
}

function getTopicKey(variantId: string | undefined, levelId: string, topicSlug: string): string {
  return `${variantId ?? "default"}:${levelId}:${topicSlug}`;
}

export function buildJourneyTrackInsights(
  track: JourneyTrack,
  completedStoryKeys: Set<string>,
  practicedTopicKeys: Set<string>,
  passedCheckpointKeys: Set<string>,
  dueReviewItems: Array<{ progressKey: string | null }>
): JourneyTrackInsights {
  const dueReviewProgressKeySet = new Set(
    dueReviewItems.map((item) => item.progressKey).filter((v): v is string => Boolean(v))
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

      const requiredStoryCount = getRequiredStoryCount(topic);
      const completedStoryCount = getCompletedStoryCount(topic, completedStoryKeys);
      const completedRequiredCount = Math.min(completedStoryCount, requiredStoryCount);
      const practiceKey = getTopicKey(track.id, level.id, topic.slug);
      const checkpointKey = getTopicKey(track.id, level.id, topic.slug);
      const practiced = practicedTopicKeys.has(practiceKey);
      const checkpointPassed = passedCheckpointKeys.has(checkpointKey);
      const complete = requiredStoryCount > 0 && completedStoryCount >= requiredStoryCount;
      const topicDueCount = topic.stories.reduce(
        (sum, story) => sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0),
        0
      );

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
          nextMilestone = `Read ${remaining} more ${remaining === 1 ? "story" : "stories"} in ${topic.label}`;
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
