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
 * Returns null when the story has no alignment yet; practice items
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
    select: { voiceId: true, practiceVoiceId: true },
  });
  // practiceVoiceId override wins over the narrator voice (practiceVoice.ts).
  const storyVoiceId = journeyVoice?.practiceVoiceId?.trim() || journeyVoice?.voiceId || null;

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
  // `items` otherwise; so legacy clients keep working.
  // `?pool=1` returns the non-featured POOL (extra practice); default returns the
  // featured ~10 that show at the end of the story. poolCount lets the result
  // screen offer "Practice the rest" only when a pool actually exists.
  const poolMode = searchParams.get("pool") === "1";
  const persistedExercises = await loadPersistedExercises(storySlug, !poolMode);
  let poolCount = 0;
  try {
    poolCount = await prisma.storyPracticeExercise.count({
      where: { featured: false, set: { story: { slug: storySlug, status: "published" } } },
    });
  } catch {
    poolCount = 0;
  }
  const nextStory = await resolveNextStory(storySlug);

  // narratorVoiceId: the story's own narrator, so the practice page renders the
  // isolated-word audio in the story's country accent (see lib/practiceVoice.ts).
  return NextResponse.json({
    items,
    exercises: persistedExercises ?? undefined,
    poolCount,
    nextStory,
    narratorVoiceId: storyVoiceId,
  });
}

// The next story in the journey's curriculum order (level → topic → slotIndex,
// where level/topic order comes from Journey.levels[]/topics[]). kind="topic"
// when the next story starts a new topic. Powers the result-screen "Next story /
// Next topic" action (never "Back to the story you just read").
async function resolveNextStory(
  storySlug: string
): Promise<{ slug: string; title: string; kind: "story" | "topic"; topic: string } | null> {
  try {
    const cur = await prisma.journeyStory.findFirst({
      where: { slug: storySlug, status: "published" },
      select: {
        journeyId: true,
        level: true,
        topic: true,
        slotIndex: true,
        journey: { select: { levels: true, topics: true } },
      },
    });
    if (!cur) return null;
    const stories = await prisma.journeyStory.findMany({
      where: { journeyId: cur.journeyId, status: "published", slug: { not: null }, title: { not: null } },
      select: { slug: true, title: true, level: true, topic: true, slotIndex: true },
    });
    const levels = cur.journey.levels;
    const topics = cur.journey.topics;
    const rank = (s: { level: string; topic: string; slotIndex: number }): [number, number, number] => [
      levels.indexOf(s.level),
      topics.indexOf(s.topic),
      s.slotIndex,
    ];
    stories.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < 3; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });
    const idx = stories.findIndex((s) => s.slug === storySlug);
    const next = idx >= 0 ? stories[idx + 1] : null;
    if (!next || !next.slug || !next.title) return null;
    return { slug: next.slug, title: next.title, kind: next.topic !== cur.topic ? "topic" : "story", topic: next.topic };
  } catch {
    return null;
  }
}

// Deterministic option shuffle. Curated/persisted sets often store the
// correct answer as options[0] (it's the natural way to author them), and the
// reader renders options in array order — so without this the right answer
// always lands in the same (top-left) slot across every exercise, which is an
// obvious giveaway. Seeding the shuffle on the exercise id keeps the order
// STABLE across reloads (no jarring reshuffle) while varying it per exercise,
// and makes the fix immune to how any future seed is authored. The answer is
// matched by value downstream, never by index, so reordering is safe.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleOptionsDeterministic(options: string[], seedStr: string): string[] {
  if (options.length < 2) return options;
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = mulberry32(h);
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Deterministic permutation of [0..n-1] for the given seed, so options AND any
// parallel array (e.g. optionTranslations) can be shuffled together — otherwise
// the English gloss ends up under the wrong word.
function shuffleIndices(n: number, seedStr: string): number[] {
  return shuffleOptionsDeterministic(Array.from({ length: n }, (_, i) => String(i)), seedStr).map(Number);
}

// Match meanings render index-aligned with the words column, so if the meaning
// at row i is the answer for the word at row i the pairing is trivially given
// away (just tap straight across). Derange the meanings column: deterministic
// shuffle, then rotate until NO row's meaning equals that row's answer. This
// guarantees the spatial alignment is broken while staying stable across
// reloads and varied per exercise.
function derangeMeanings(answersInRowOrder: string[], seedStr: string): string[] {
  const n = answersInRowOrder.length;
  if (n < 2) return [...answersInRowOrder];
  let order = shuffleOptionsDeterministic(answersInRowOrder, `${seedStr}:m`);
  let guard = 0;
  while (order.some((m, i) => m === answersInRowOrder[i]) && guard < n) {
    order = [...order.slice(1), order[0]];
    guard++;
  }
  return order;
}

async function loadPersistedExercises(
  storySlug: string,
  featuredOnly: boolean
): Promise<PracticeExercise[] | null> {
  if (!storySlug) return null;
  // featuredOnly=true → the ~10 that surface end-of-story. featuredOnly=false →
  // the POOL (the rest), shown when the user taps Practice for the story.
  // Migration 20260518180000 defaults featured=true so pre-migration sets keep
  // their full set in the featured bucket.
  const set = await prisma.storyPracticeSet.findFirst({
    where: { story: { slug: storySlug, status: "published" } },
    include: {
      exercises: {
        where: { featured: featuredOnly },
        orderBy: { orderIndex: "asc" },
        // Explicit select: only the columns this loop reads. The Fase-1
        // additive columns (cefr/audioText/audioVoiceId/distractorSource)
        // exist in the Prisma schema/client but are NOT migrated to prod
        // yet, so an `include` (which selects every scalar) throws "column
        // cefr does not exist". Scoping the select keeps this route working
        // on the un-migrated DB and after the migration alike.
        select: {
          id: true,
          type: true,
          word: true,
          sentence: true,
          payload: true,
          audioUrl: true,
        },
      },
    },
  });
  if (!set || set.exercises.length === 0) return null;
  const out: PracticeExercise[] = [];
  for (const row of set.exercises) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
    // Inject the persisted R2 mp3 url into the audioClip so the mobile
    // client can play it directly without hitting Modal Piper at
    // runtime. Modal cold-starts caused intermittent silent plays; the
    // editor pre-generates these audios from Studio so by the time a
    // user reaches the exercise, the mp3 is already on R2.
    //
    // Two pre-generation pipelines write the persisted mp3 to different
    // places: the Modal/Piper script writes the `audioUrl` COLUMN, while the
    // ElevenLabs narrator pipeline (_genPracticeClips.ts) writes
    // `payload.audioClip.clipUrl`. The mobile client only plays `cachedUrl`,
    // so cachedUrl must fall back to clipUrl or every ElevenLabs-rendered
    // journey (e.g. German) plays silent even though the clip exists.
    const rawClip = (payload.audioClip ?? null) as Record<string, unknown> | null;
    const rawClipUrl = typeof rawClip?.clipUrl === "string" ? rawClip.clipUrl : null;
    const persistedClipUrl = row.audioUrl ?? rawClipUrl;
    const audioClip = rawClip
      ? { ...rawClip, cachedUrl: persistedClipUrl }
      : (persistedClipUrl ? { cachedUrl: persistedClipUrl } : null);
    switch (row.type) {
      case "fill_blank": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const rawTr = Array.isArray(payload.optionTranslations) ? (payload.optionTranslations as string[]) : null;
        const order = shuffleIndices(rawOptions.length, row.id);
        const options = order.map((i) => rawOptions[i]);
        const optionTranslations = rawTr ? order.map((i) => rawTr[i]) : null;
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        out.push({
          id: `fill_blank:${row.id}`,
          type: "fill_blank",
          prompt,
          sentence: row.sentence,
          translation: typeof payload.translation === "string" ? payload.translation : null,
          optionTranslations,
          storySlug,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          options,
          answer,
        });
        break;
      }
      case "meaning_in_context": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const options = shuffleOptionsDeterministic(rawOptions, row.id);
        const answer = typeof payload.answer === "string" ? payload.answer : "";
        out.push({
          id: `meaning_in_context:${row.id}`,
          type: "meaning_in_context",
          prompt,
          word: row.word,
          sentence: row.sentence,
          storySlug,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          options,
          answer,
        });
        break;
      }
      case "listen_choose": {
        const rawOptions = Array.isArray(payload.options) ? (payload.options as string[]) : [];
        const rawTr = Array.isArray(payload.optionTranslations) ? (payload.optionTranslations as string[]) : null;
        const order = shuffleIndices(rawOptions.length, row.id);
        const options = order.map((i) => rawOptions[i]);
        const optionTranslations = rawTr ? order.map((i) => rawTr[i]) : null;
        const answer = typeof payload.answer === "string" ? payload.answer : row.word;
        const language = typeof payload.language === "string" ? payload.language : null;
        out.push({
          id: `listen_choose:${row.id}`,
          type: "listen_choose",
          prompt,
          speechText: row.sentence,
          language,
          options,
          optionTranslations,
          audioClip: audioClip as PracticeExercise extends { audioClip?: infer T } ? T : never,
          answer,
        });
        break;
      }
      case "match_meaning": {
        const rawPairs = Array.isArray(payload.pairs) ? (payload.pairs as Array<{ word: string; answer: string; options: string[] }>) : [];
        // The meanings column renders from each pair's `options[index]`, aligned
        // by row with the words column. Replace options with a deranged order so
        // no meaning sits straight across from its own word. Answers are matched
        // by value downstream, so reordering the displayed meanings is safe.
        const answersInRowOrder = rawPairs.map((p) => p.answer);
        const deranged = derangeMeanings(answersInRowOrder, row.id);
        const pairs = rawPairs.map((p) => ({ ...p, options: deranged }));
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
