export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import {
  buildJourneyTrackInsights,
  buildJourneyVariants,
  getJourneyPlacementLevelIndex,
  getJourneyTopicCheckpointKey,
  getJourneyTopicCompletedStoryCount,
  getJourneyTopicPracticeKey,
  getJourneyTopicRequiredStoryCount,
  getUnlockedStoryCount,
  getUnlockedLevelCount,
  getUnlockedTopicCount,
} from "@/app/journey/journeyData";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getJourneyFocusFromLearningGoal, normalizeJourneyFocus } from "@/lib/onboarding";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedLanguage = req.nextUrl.searchParams.get("language");
  const language =
    requestedLanguage
      ? requestedLanguage
      : session.targetLanguages[0] || "Spanish";
  const user = await clerkClient.users.getUser(session.sub);
  const journeyFocus =
    typeof user.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null
        );
  const journeyPlacementLevel =
    typeof user.publicMetadata?.journeyPlacementLevel === "string"
      ? user.publicMetadata.journeyPlacementLevel
      : null;
  const [tracks, completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] =
    await Promise.all([
      buildJourneyVariants(language, journeyFocus ?? "General"),
      getCompletedJourneyStoryKeys(session.sub),
      getPassedJourneyCheckpointKeys(session.sub),
      getPracticedJourneyTopicKeys(session.sub),
      getJourneyDueReviewItems(200, session.sub),
    ]);

  const dueReviewProgressKeySet = new Set(
    dueReviewItems.map((item) => item.progressKey).filter((value): value is string => Boolean(value))
  );

  const summarizedTracks = tracks.map((track) => {
    const baseUnlockedLevelCount = getUnlockedLevelCount(
      track.levels,
      completedStoryKeys,
      passedCheckpointKeys,
      track.id
    );
    const placementLevelIndex = getJourneyPlacementLevelIndex(track.levels, journeyPlacementLevel);
    const unlockedLevelCount =
      placementLevelIndex >= 0
        ? Math.max(baseUnlockedLevelCount, Math.min(track.levels.length, placementLevelIndex + 1))
        : baseUnlockedLevelCount;

    return {
      id: track.id,
      label: track.label,
      insights: buildJourneyTrackInsights(
        track,
        completedStoryKeys,
        practicedTopicKeys,
        passedCheckpointKeys,
        dueReviewItems
      ),
      unlockedLevelCount,
      totalLevelCount: track.levels.length,
      levels: track.levels.map((level, levelIndex) => {
        const baseUnlockedTopicCount =
          levelIndex < unlockedLevelCount
            ? getUnlockedTopicCount(
                level,
                completedStoryKeys,
                passedCheckpointKeys,
                track.id,
                level.id
              )
            : 0;
        const unlockedTopicCount =
          placementLevelIndex >= 0 && levelIndex < placementLevelIndex
            ? level.topics.length
            : baseUnlockedTopicCount;

        return {
          id: level.id,
          title: level.title,
          subtitle: level.subtitle,
          unlocked: levelIndex < unlockedLevelCount,
          unlockedTopicCount,
          totalTopicCount: level.topics.length,
          topics: level.topics.map((topic, topicIndex) => {
            const completedStoryCount = getJourneyTopicCompletedStoryCount(topic, completedStoryKeys);
            const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
            const practiceKey = getJourneyTopicPracticeKey(track.id, level.id, topic.slug);
            const checkpointKey = getJourneyTopicCheckpointKey(track.id, level.id, topic.slug);
            const topicUnlocked = levelIndex < unlockedLevelCount && topicIndex < unlockedTopicCount;
            const unlockedStoryCount = topicUnlocked
              ? placementLevelIndex >= 0 && levelIndex < placementLevelIndex
                ? topic.storyCount
                : getUnlockedStoryCount(topic, completedStoryKeys)
              : 0;
            return {
              id: topic.id,
              slug: topic.slug,
              label: topic.label,
              unlocked: topicUnlocked,
              complete: requiredStoryCount > 0 && completedStoryCount >= requiredStoryCount,
              practiced: practicedTopicKeys.has(practiceKey),
              checkpointPassed: passedCheckpointKeys.has(checkpointKey),
              storyCount: topic.storyCount,
              storyTarget: topic.storyTarget ?? null,
              completedStoryCount,
              requiredStoryCount,
              dueReviewCount: topic.stories.reduce((sum, story) => {
                return sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0);
              }, 0),
              hasDueReview: topic.stories.some((story) => dueReviewProgressKeySet.has(story.progressKey)),
              unlockedStoryCount,
              stories: topic.stories.map((story, storyIndex) => ({
                id: story.id,
                storySlug: story.storySlug,
                title: story.title,
                coverUrl: story.coverUrl ?? null,
                progressKey: story.progressKey,
                language: story.language ?? null,
                region: story.region ?? null,
                unlocked: topicUnlocked && storyIndex < unlockedStoryCount,
                completed: completedStoryKeys.has(story.progressKey),
              })),
            };
          }),
        };
      }),
    };
  });

  return NextResponse.json({
    language,
    dueReviewCount: dueReviewItems.length,
    tracks: summarizedTracks,
  });
}
