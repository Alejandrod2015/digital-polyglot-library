export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  buildJourneyTopicCheckpoint,
  buildJourneyTopicPracticeItems,
  getUnlockedStoryCount,
  isJourneyTopicComplete,
} from "@/app/journey/journeyData";
import {
  buildTopicCheckpointPracticeSession,
  getDuePracticeItems,
  mergePracticeItemsByWord,
  type PracticeFavoriteItem,
} from "@/lib/practiceExercises";
import { createJourneyCheckpointToken } from "@/lib/journeyCheckpointToken";
import { getCompletedJourneyStoryKeys } from "@/lib/journeyProgress";
import { normalizeVariant } from "@/lib/languageVariant";
import { practiceVoiceId } from "@/lib/practiceVoice";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

function getProgressKeyFromSourcePath(sourcePath: string, storySlug: string): string | null {
  const normalizedPath = sourcePath.trim();
  const normalizedSlug = storySlug.trim();
  if (!normalizedPath || !normalizedSlug) return null;

  if (normalizedPath.startsWith("/books/")) {
    return normalizedPath.replace(/^\/books\//, "").replace(/\//g, ":");
  }

  if (normalizedPath.startsWith("/stories/")) {
    return `standalone:${normalizedSlug}`;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const mobileSession = getMobileSessionFromRequest(request);
  const { userId: clerkUserId } = getAuth(request);
  const userId = mobileSession?.sub ?? clerkUserId ?? null;
  const { searchParams } = new URL(request.url);
  const variant = normalizeVariant(searchParams.get("variant"));
  const levelId = (searchParams.get("levelId") ?? "").trim().toLowerCase();
  const topicId = (searchParams.get("topicId") ?? "").trim().toLowerCase();
  const kind = (searchParams.get("kind") ?? "topic").trim().toLowerCase();

  if (!levelId || !topicId) {
    return NextResponse.json({ error: "Missing levelId or topicId" }, { status: 400 });
  }

  const source = await buildJourneyTopicPracticeItems(variant ?? undefined, levelId, topicId);
  if (!source) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const completedStoryKeys = await getCompletedJourneyStoryKeys(userId ?? undefined);
  const unlockedStoryCount = getUnlockedStoryCount(source.topic, completedStoryKeys);
  const unlockedProgressKeys = new Set(
    source.topic.stories.slice(0, unlockedStoryCount).map((story) => story.progressKey)
  );
  const unlockedItems = source.items.filter((item) => {
    const storySlug = (item.storySlug ?? "").trim();
    const sourcePath = (item.sourcePath ?? "").trim();
    if (!storySlug || !sourcePath) return false;
    const progressKey = getProgressKeyFromSourcePath(sourcePath, storySlug);
    if (!progressKey) return false;
    return unlockedProgressKeys.has(progressKey);
  });

  const unlockedStorySlugs = source.topic.stories
    .slice(0, unlockedStoryCount)
    .map((story) => story.progressKey.split(":")[1] ?? "")
    .filter(Boolean);

  // Practice word audio: the isolated-word clips in R2 are content-addressed
  // by the SOURCE story's PRACTICE voice (see lib/practiceVoice.ts +
  // _genJourneyWords.ts). A topic pools words from several stories, each with
  // its own voice, so we resolve and stamp each item with its story's practice
  // voice here. Without it the practice page has no per-word voice and falls
  // back to a single fixed voiceId whose clips were never generated -> 404 ->
  // silent word audio. (Story practice already carries this via narratorVoiceId.)
  const practiceVoiceBySlug = new Map<string, string>();
  if (unlockedStorySlugs.length > 0) {
    const voiceRows = await prisma.journeyStory.findMany({
      where: { slug: { in: unlockedStorySlugs } },
      select: { slug: true, voiceId: true, practiceVoiceId: true },
    });
    for (const row of voiceRows) {
      if (!row.slug) continue;
      try {
        practiceVoiceBySlug.set(row.slug, practiceVoiceId(row));
      } catch {
        // Story has no narrator voiceId; leave unmapped (word audio falls back).
      }
    }
  }
  const withPracticeVoice = (item: PracticeFavoriteItem): PracticeFavoriteItem => {
    const slug = (item.storySlug ?? "").trim();
    const resolved = (slug && practiceVoiceBySlug.get(slug)) || item.voiceId || null;
    return item.voiceId === resolved ? item : { ...item, voiceId: resolved };
  };

  let savedTopicItems: PracticeFavoriteItem[] = [];
  if (userId && unlockedStorySlugs.length > 0) {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        storySlug: { in: unlockedStorySlugs },
      },
      orderBy: { createdAt: "desc" },
    });

    savedTopicItems = favorites.map((favorite) => ({
      word: favorite.word,
      translation: favorite.translation,
      wordType: favorite.wordType,
      exampleSentence: favorite.exampleSentence,
      storySlug: favorite.storySlug,
      storyTitle: favorite.storyTitle,
      sourcePath: favorite.sourcePath,
      language: favorite.language,
      nextReviewAt: favorite.nextReviewAt ? favorite.nextReviewAt.toISOString() : null,
      practiceSource: "user_saved",
    }));
  }

  const topicPracticeItems = mergePracticeItemsByWord([...unlockedItems, ...savedTopicItems]);
  const dueTopicItems = getDuePracticeItems(topicPracticeItems);

  if (kind === "checkpoint") {
    if (!isJourneyTopicComplete(source.topic, completedStoryKeys)) {
      return NextResponse.json({ error: "Topic checkpoint locked" }, { status: 403 });
    }
    const checkpoint = await buildJourneyTopicCheckpoint(variant ?? undefined, levelId, topicId);
    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not available" }, { status: 404 });
    }
    const exercises = buildTopicCheckpointPracticeSession(source.items.map(withPracticeVoice));
    const answers = Object.fromEntries(
      exercises
        .filter((exercise) => exercise.type !== "match_meaning")
        .map((exercise) => [exercise.id, exercise.answer])
    );

    return NextResponse.json({
      variantId: variant,
      level: {
        id: source.level.id,
        title: source.level.title,
        subtitle: source.level.subtitle,
      },
      topic: {
        id: source.topic.id,
        slug: source.topic.slug,
        label: source.topic.label,
        storyCount: source.topic.storyCount,
      },
      items: source.items.map(withPracticeVoice),
      exercises,
      checkpointToken: createJourneyCheckpointToken({
        variantId: variant,
        levelId,
        topicSlug: topicId,
        answers,
      }),
    });
  }

  return NextResponse.json({
    variantId: variant,
    level: {
      id: source.level.id,
      title: source.level.title,
      subtitle: source.level.subtitle,
    },
    topic: {
      id: source.topic.id,
      slug: source.topic.slug,
      label: source.topic.label,
      storyCount: source.topic.storyCount,
    },
    review: {
      dueCount: dueTopicItems.length,
      totalCount: topicPracticeItems.length,
      focusWords: dueTopicItems.slice(0, 3).map((item) => item.word),
    },
    items: topicPracticeItems.map(withPracticeVoice),
  });
}
