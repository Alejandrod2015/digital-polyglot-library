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
import { mergePracticeItemsByWord, type PracticeExercise, type PracticeFavoriteItem } from "@/lib/practiceExercises";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import type { AudioWordTimingsPayload } from "@domain";

/**
 * Aeneas word-level alignment for a story. Tries JourneyStory first
 * (Studio-published curriculum), then `CatalogStoryAudioTimings` (the
 * sidecar table that holds timings for static catalog stories).
 * Returns null when the story has no alignment yet — practice items
 * still build, but their audio falls back to HQ TTS on mobile.
 */
async function getAudioWordTimingsForSlug(slug: string): Promise<AudioWordTimingsPayload | null> {
  const journeyRow = await prisma.journeyStory.findFirst({
    where: { slug, status: "published" },
    select: { audioWordTimings: true },
  });
  const journey = coerceAudioWordTimings(journeyRow?.audioWordTimings ?? null);
  if (journey) return journey;
  const catalogRow = await prisma.catalogStoryAudioTimings.findUnique({
    where: { slug },
    select: { audioWordTimings: true },
  });
  return coerceAudioWordTimings(catalogRow?.audioWordTimings ?? null);
}

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

    const audioWordTimings = await getAudioWordTimingsForSlug(story.slug);
    storyItems = buildPracticeItemsFromStory({
      title: story.title,
      slug: story.slug,
      text: story.text,
      language: story.language ?? book.language,
      sourcePath: `/books/${book.slug}/${story.slug}`,
      vocab: story.vocab ?? [],
      practiceSource: "curriculum",
      audioWordTimings,
    });
  } else {
    // Try Sanity standalones first, then Prisma journey stories (Studio-created),
    // then userStory (Polyglot / Create-page generated). Without the journey
    // fallback the mobile "Start practice" prompt 404s for every Studio story.
    const standaloneStory = await getStandaloneStoryBySlug(storySlug);
    const journeyStory = standaloneStory ? null : await getJourneyStoryBySlug(storySlug);
    const resolvedStandalone = standaloneStory ?? journeyStory;

    if (resolvedStandalone) {
      // sourcePath: solo marcar `?source=standalone` cuando la historia
      // viene de Sanity (CMS) y vive en el registry hardcoded de
      // standaloneStoryAudioSegments. Para JourneyStory (Studio) pasamos
      // sin query: el móvil resuelve `storySource = "user"` y consulta
      // `/api/user-stories`, que SÍ encuentra la JourneyStory por slug y
      // devuelve audioUrl + audioSegments aeneas. Marcarla como standalone
      // mandaba la fetch a `/api/standalone-story-audio` que solo conoce
      // 1 historia y dejaba el resto sin audio en práctica.
      const isSanityStandalone = standaloneStory != null;
      const sourcePath = isSanityStandalone
        ? `/stories/${resolvedStandalone.slug}?source=standalone`
        : `/stories/${resolvedStandalone.slug}`;
      const audioWordTimings = await getAudioWordTimingsForSlug(resolvedStandalone.slug);
      storyItems = buildPracticeItemsFromStory({
        title: resolvedStandalone.title,
        slug: resolvedStandalone.slug,
        text: resolvedStandalone.text,
        language: resolvedStandalone.language,
        sourcePath,
        vocab: parseLooseVocab(resolvedStandalone.vocabRaw),
        practiceSource: "curriculum",
        voiceId: resolvedStandalone.voiceId,
        audioWordTimings,
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
      const audioWordTimings = await getAudioWordTimingsForSlug(resolvedSlug);
      storyItems = buildPracticeItemsFromStory({
        title: mirror?.title ?? userStory?.title ?? "Untitled story",
        slug: resolvedSlug,
        text: mirror?.text ?? userStory?.text ?? "",
        language: mirror?.language ?? userStory?.language ?? null,
        sourcePath: `/stories/${resolvedSlug}?source=polyglot`,
        vocab: parseLooseVocab(mirror?.vocabRaw ?? userStory?.vocab ?? []),
        practiceSource: "curriculum",
        audioWordTimings,
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

  // Look up the journey voiceId once for this story so every favorite
  // attached to it carries the same voice hint to the TTS endpoint.
  const journeyVoice = await prisma.journeyStory.findFirst({
    where: { slug: storySlug },
    select: { voiceId: true },
  });
  const storyVoiceId = journeyVoice?.voiceId ?? null;

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
    voiceId: storyVoiceId,
  }));

  const items = mergePracticeItemsByWord([...storyItems, ...savedItems]);

  // If an editorially curated practice set exists for this journey
  // story, surface its exercises in the response. The mobile client
  // prefers `exercises` when present and falls back to building from
  // `items` otherwise — so legacy clients keep working.
  const persistedExercises = await loadPersistedExercises(storySlug);

  return NextResponse.json({ items, exercises: persistedExercises ?? undefined });
}

async function loadPersistedExercises(storySlug: string): Promise<PracticeExercise[] | null> {
  if (!storySlug) return null;
  // Only featured rows surface end-of-story; the rest live in the pool
  // and only show in the Practice tab. Migration 20260518180000 defaults
  // featured=true so pre-migration sets keep their full 10 here.
  const set = await prisma.storyPracticeSet.findFirst({
    where: { story: { slug: storySlug, status: "published" } },
    include: {
      exercises: {
        where: { featured: true },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!set || set.exercises.length === 0) return null;
  const out: PracticeExercise[] = [];
  for (const row of set.exercises) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    switch (row.type) {
      case "fill_blank": {
        const options = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        out.push({
          id: `fill_blank:${row.id}`,
          type: "fill_blank",
          prompt,
          sentence: row.sentence,
          storySlug,
          audioClip: (payload.audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never) ?? null,
          options,
          answer,
        });
        break;
      }
      case "meaning_in_context": {
        const options = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const answer = typeof payload.answer === "string" ? payload.answer : "";
        out.push({
          id: `meaning_in_context:${row.id}`,
          type: "meaning_in_context",
          prompt,
          word: row.word,
          sentence: row.sentence,
          storySlug,
          audioClip: (payload.audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never) ?? null,
          options,
          answer,
        });
        break;
      }
      case "natural_expression": {
        const options = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        out.push({
          id: `natural_expression:${row.id}`,
          type: "natural_expression",
          prompt,
          sentence: row.sentence,
          storySlug,
          audioClip: (payload.audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never) ?? null,
          options,
          answer,
        });
        break;
      }
      case "listen_choose": {
        const options = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        const language = typeof payload.language === "string" ? payload.language : null;
        out.push({
          id: `listen_choose:${row.id}`,
          type: "listen_choose",
          prompt,
          speechText: row.sentence,
          language,
          options,
          answer,
        });
        break;
      }
      case "match_meaning": {
        const pairs = Array.isArray(payload.pairs) ? (payload.pairs as Array<{ word: string; answer: string; options: string[] }>) : [];
        out.push({
          id: `match_meaning:${row.id}`,
          type: "match_meaning",
          prompt,
          pairs,
        });
        break;
      }
    }
  }
  return out;
}
