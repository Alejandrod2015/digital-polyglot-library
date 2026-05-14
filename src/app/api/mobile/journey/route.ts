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
  getUnlockedLevelCount,
} from "@/app/journey/journeyData";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getJourneyFocusFromLearningGoal, normalizeJourneyFocus } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedLanguage = req.nextUrl.searchParams.get("language");
  let language: string;
  if (requestedLanguage) {
    language = requestedLanguage;
  } else if (session.targetLanguages[0]) {
    language = session.targetLanguages[0];
  } else {
    // No explicit preference. Use the language of the most recently published
    // journey story (created in the Studio) so solo-language accounts without
    // targetLanguages configured still see their own content instead of a
    // hardcoded "Spanish" fallback.
    const latestJourneyStory = await prisma.journeyStory.findFirst({
      where: { status: "published" },
      include: { journey: { select: { language: true } } },
      orderBy: { createdAt: "desc" },
    });
    language = latestJourneyStory?.journey?.language ?? "Spanish";
  }
  const user = await clerkClient.users.getUser(session.sub);
  const journeyFocus =
    typeof user.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null
        );
  const rawJourneyPlacementLevel =
    typeof user.publicMetadata?.journeyPlacementLevel === "string"
      ? user.publicMetadata.journeyPlacementLevel
      : null;
  const [rawTracks, completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] =
    await Promise.all([
      buildJourneyVariants(language, journeyFocus ?? "General"),
      getCompletedJourneyStoryKeys(session.sub),
      getPassedJourneyCheckpointKeys(session.sub),
      getPracticedJourneyTopicKeys(session.sub),
      getJourneyDueReviewItems(200, session.sub),
    ]);

  // SAFETY NET: si el usuario tiene `journeyPlacementLevel` set pero
  // todavía no ha terminado ni una sola historia EN EL IDIOMA ACTUAL,
  // el placement no aporta — solo está marcando como `skipped` los
  // niveles inferiores y empujando la "next" hacia abajo. En ese caso
  // lo limpiamos en Clerk y servimos la respuesta sin placement.
  // Self-healing: cualquier futura request ya verá
  // `journeyPlacementLevel = null` desde Clerk.
  //
  // Nota importante: comparamos contra los progressKeys de las
  // historias DEL TRACK ACTUAL (filtradas por idioma). El set
  // `completedStoryKeys` es global (incluye todos los idiomas), así
  // que un usuario con progreso en otros idiomas pero 0 en este sigue
  // disparando el self-heal.
  let journeyPlacementLevel = rawJourneyPlacementLevel;
  if (journeyPlacementLevel) {
    let hasProgressInThisLanguage = false;
    outer: for (const track of rawTracks) {
      for (const level of track.levels) {
        for (const topic of level.topics) {
          for (const story of topic.stories) {
            if (completedStoryKeys.has(story.progressKey)) {
              hasProgressInThisLanguage = true;
              break outer;
            }
          }
        }
      }
    }
    if (!hasProgressInThisLanguage) {
      try {
        const updatedMetadata: Record<string, unknown> = { ...(user.publicMetadata ?? {}) };
        delete updatedMetadata.journeyPlacementLevel;
        await clerkClient.users.updateUserMetadata(session.sub, {
          publicMetadata: updatedMetadata,
        });
        journeyPlacementLevel = null;
      } catch {
        // Best-effort: si Clerk falla, simplemente seguimos con el valor
        // actual; la próxima request volverá a intentar.
      }
    }
  }
  // Variable kept under the original name so the rest of the route reads
  // unchanged.
  const tracks = rawTracks;

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
      variant: track.variant ?? null,
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
        // With Model B (lock at level boundaries only), every topic in an
        // unlocked level is accessible, so unlockedTopicCount is just the
        // total when the level is unlocked. We keep the field on the wire
        // for any client that still reads it.
        const unlocked = levelIndex < unlockedLevelCount;
        const unlockedTopicCount = unlocked ? level.topics.length : 0;

        return {
          id: level.id,
          title: level.title,
          subtitle: level.subtitle,
          unlocked,
          unlockedTopicCount,
          totalTopicCount: level.topics.length,
          topics: level.topics.map((topic) => {
            const completedStoryCount = getJourneyTopicCompletedStoryCount(topic, completedStoryKeys);
            const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
            const practiceKey = getJourneyTopicPracticeKey(track.id, level.id, topic.slug);
            const checkpointKey = getJourneyTopicCheckpointKey(track.id, level.id, topic.slug);
            // Lock only at the level boundary. Within an unlocked CEFR level,
            // every topic and every story is accessible — the user can read
            // them in whatever order suits them. The recommended order is
            // still expressed via the "next" pointer, but it's a guide, not
            // a gate. Stories above the user's reach (locked level) still
            // show with the lock icon and tap into the placement-test offer.
            const topicUnlocked = levelIndex < unlockedLevelCount;
            const unlockedStoryCount = topicUnlocked ? topic.storyCount : 0;
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
              stories: topic.stories.map((story, storyIndex) => {
                // Three-state progression model:
                //   - audioFinished: user listened to the audio in
                //     full (or scrubbed past 95%). Story is "read"
                //     but exercises are still pending.
                //   - completed: audio finished AND the topic's
                //     checkpoint is passed. Earns the green check.
                //   - skipped: story belongs to a level below the
                //     user's placement level. Stays unlocked and
                //     re-readable but doesn't count as pending —
                //     used so the "next" pointer can jump straight
                //     to the placement level without falsely
                //     awarding the green check on unread stories.
                const audioFinished = completedStoryKeys.has(story.progressKey);
                const checkpointPassedForTopic = passedCheckpointKeys.has(checkpointKey);
                return {
                  id: story.id,
                  storySlug: story.storySlug,
                  title: story.title,
                  coverUrl: story.coverUrl ?? null,
                  progressKey: story.progressKey,
                  language: story.language ?? null,
                  region: story.region ?? null,
                  unlocked: topicUnlocked && storyIndex < unlockedStoryCount,
                  audioFinished,
                  completed: audioFinished && checkpointPassedForTopic,
                  skipped:
                    placementLevelIndex >= 0 && levelIndex < placementLevelIndex,
                };
              }),
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
