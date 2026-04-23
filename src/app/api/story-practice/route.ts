export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { books } from "@/data/books";
import { prisma } from "@/lib/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import { getJourneyStoryBySlug } from "@/lib/journeyStories";
import { getCreateStoryMirrorBySlug } from "@/lib/userStories";
import { buildPracticeItemsFromStory, parseLooseVocab } from "@/lib/storyPracticeItems";
import { mergePracticeItemsByWord, type PracticeFavoriteItem } from "@/lib/practiceExercises";

export async function GET(request: NextRequest) {
  const mobileSession = getMobileSessionFromRequest(request);
  const { userId: clerkUserId } = getAuth(request);
  const userId = mobileSession?.sub ?? clerkUserId ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const storySlug = (searchParams.get("storySlug") ?? "").trim();
  const bookSlug = (searchParams.get("bookSlug") ?? "").trim();

  if (!storySlug) {
    return NextResponse.json({ error: "Missing storySlug" }, { status: 400 });
  }

  let storyItems: PracticeFavoriteItem[] = [];

  if (bookSlug) {
    const book = Object.values(books).find((candidate) => candidate.slug === bookSlug);
    const story = book?.stories.find((candidate) => candidate.slug === storySlug);

    if (!book || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    storyItems = buildPracticeItemsFromStory({
      title: story.title,
      slug: story.slug,
      text: story.text,
      language: story.language ?? book.language,
      sourcePath: `/books/${book.slug}/${story.slug}`,
      vocab: story.vocab ?? [],
      practiceSource: "curriculum",
    });
  } else {
    // Try Sanity standalones first, then Prisma journey stories (Studio-created),
    // then userStory (Polyglot / Create-page generated). Without the journey
    // fallback the mobile "Start practice" prompt 404s for every Studio story.
    const standaloneStory = await getStandaloneStoryBySlug(storySlug);
    const journeyStory = standaloneStory ? null : await getJourneyStoryBySlug(storySlug);
    const resolvedStandalone = standaloneStory ?? journeyStory;

    if (resolvedStandalone) {
      storyItems = buildPracticeItemsFromStory({
        title: resolvedStandalone.title,
        slug: resolvedStandalone.slug,
        text: resolvedStandalone.text,
        language: resolvedStandalone.language,
        sourcePath: `/stories/${resolvedStandalone.slug}?source=standalone`,
        vocab: parseLooseVocab(resolvedStandalone.vocabRaw),
        practiceSource: "curriculum",
      });
    } else {
      const mirror = await getCreateStoryMirrorBySlug(storySlug);
      const userStory = mirror
        ? await prisma.userStory.findUnique({
            where: { id: mirror.createStoryId },
            select: {
              id: true,
              title: true,
              slug: true,
              text: true,
              language: true,
              vocab: true,
            },
          })
        : await prisma.userStory.findUnique({
            where: { slug: storySlug },
            select: {
              id: true,
              title: true,
              slug: true,
              text: true,
              language: true,
              vocab: true,
            },
          });

      if (!mirror && !userStory) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      const resolvedSlug = mirror?.slug ?? userStory?.slug ?? storySlug;
      storyItems = buildPracticeItemsFromStory({
        title: mirror?.title ?? userStory?.title ?? "Untitled story",
        slug: resolvedSlug,
        text: mirror?.text ?? userStory?.text ?? "",
        language: mirror?.language ?? userStory?.language ?? null,
        sourcePath: `/stories/${resolvedSlug}?source=polyglot`,
        vocab: parseLooseVocab(mirror?.vocabRaw ?? userStory?.vocab ?? []),
        practiceSource: "curriculum",
      });
    }
  }

  const savedFavorites = await prisma.favorite.findMany({
    where: {
      userId,
      storySlug,
    },
    orderBy: { createdAt: "desc" },
  });

  const savedItems: PracticeFavoriteItem[] = savedFavorites.map((favorite) => ({
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

  const items = mergePracticeItemsByWord([...storyItems, ...savedItems]);
  return NextResponse.json({ items });
}
