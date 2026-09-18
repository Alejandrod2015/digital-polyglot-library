export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { getCompletedJourneyStoryKeys } from "@/lib/journeyProgress";
import { buildPracticeItemsFromStory, parseLooseVocab } from "@/lib/storyPracticeItems";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { mergePracticeItemsByWord, type PracticeFavoriteItem } from "@/lib/practiceExercises";
import { signAudioUrlsDeep } from "@/lib/mediaSigning";

/**
 * GET /api/mobile/practice/pool?language=spanish
 *
 * El pool de practica del hub que NO depende de guardar palabras. Hasta
 * 2026-09-18 el hub solo practicaba favoritos, y la mitad de los lectores no
 * guarda ninguno (scripts/_practiceFunnel.ts: 28 de 54). Este endpoint devuelve
 * el vocabulario de las historias TERMINADAS (audio completo), en dos partes:
 *
 *  1. Las palabras de las ULTIMAS `FRESH_STORIES` historias terminadas que el
 *     usuario no ha practicado ni guardado: entran como pendientes (sin
 *     `nextReviewAt`). Se limita a tres historias para que el anillo pueda
 *     cerrarse en el dia; el resto entra cuando esas se despachan.
 *  2. Toda palabra con fila `Favorite.origin = "curriculum"`: ya se practico
 *     alguna vez y lleva su repaso (FSRS). Vuelve cuando le toque.
 *
 * Nunca devuelve favoritos de verdad (`origin = "user"`): esos ya los sirve
 * /api/mobile/favorites y el movil los pone por delante.
 */
const FRESH_STORIES = 3;

/** Lo que el movil guarda por palabra: el item de practica mas su repaso. */
type PoolItem = PracticeFavoriteItem & { lastReviewedAt?: string | null; streak?: number | null };

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.sub;
  const language = norm(new URL(req.url).searchParams.get("language"));
  if (!language) {
    return NextResponse.json({ error: "Missing language" }, { status: 400 });
  }

  // Favoritos de verdad: se excluyen del pool por palabra.
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: {
      word: true,
      translation: true,
      wordType: true,
      exampleSentence: true,
      storySlug: true,
      storyTitle: true,
      sourcePath: true,
      language: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      streak: true,
      origin: true,
    },
  });
  const userSaved = new Set(rows.filter((r) => r.origin === "user").map((r) => norm(r.word)));
  const curriculumRows = rows.filter((r) => r.origin === "curriculum" && norm(r.language) === language);
  const curriculumByWord = new Map(curriculumRows.map((r) => [norm(r.word), r]));

  // Historias terminadas, de la mas reciente a la mas antigua (el Set conserva
  // el orden de insercion y getCompletedJourneyStoryKeys recorre por fecha desc).
  const completedKeys = await getCompletedJourneyStoryKeys(userId);
  // Las claves de journey son `standalone:<slug>`; las builds anteriores del
  // movil mandaban `bookSlug = "standalone-stories"`, que da
  // `standalone-stories:<slug>`. Las dos son la misma historia.
  const completedSlugs = [...completedKeys].flatMap((k) => {
    const m = /^standalone(?:-stories)?:(.+)$/.exec(k);
    return m ? [m[1]] : [];
  });

  const stories = completedSlugs.length
    ? await prisma.journeyStory.findMany({
        where: {
          slug: { in: completedSlugs },
          status: "published",
          journey: { status: { notIn: ["archived", "draft"] } },
        },
        select: {
          slug: true,
          title: true,
          text: true,
          vocab: true,
          voiceId: true,
          practiceVoiceId: true,
          audioWordTimings: true,
          journey: { select: { language: true } },
        },
      })
    : [];
  const bySlug = new Map(stories.filter((s) => s.slug).map((s) => [s.slug as string, s]));
  const recent = completedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && norm(s!.journey?.language) === language)
    .slice(0, FRESH_STORIES);

  const fresh: PoolItem[] = [];
  for (const story of recent) {
    if (!story.slug || !story.title || !story.text) continue;
    const items = buildPracticeItemsFromStory({
      title: story.title,
      slug: story.slug,
      text: story.text,
      language: story.journey?.language ?? null,
      sourcePath: `/stories/${story.slug}`,
      vocab: parseLooseVocab(story.vocab),
      practiceSource: "curriculum",
      voiceId: story.practiceVoiceId?.trim() || story.voiceId || null,
      audioWordTimings: coerceAudioWordTimings(story.audioWordTimings ?? null),
    });
    for (const item of items) {
      const key = norm(item.word);
      if (userSaved.has(key)) continue;
      const tracked = curriculumByWord.get(key);
      fresh.push(
        tracked
          ? {
              ...item,
              nextReviewAt: tracked.nextReviewAt ? tracked.nextReviewAt.toISOString() : null,
              lastReviewedAt: tracked.lastReviewedAt ? tracked.lastReviewedAt.toISOString() : null,
              streak: tracked.streak,
            }
          : item
      );
    }
  }

  // Las ya practicadas de historias mas antiguas: llevan su repaso y vuelven
  // cuando les toque. Sin frase de ejemplo nueva; la fila guardo la suya.
  const freshKeys = new Set(fresh.map((i) => norm(i.word)));
  const tracked: PoolItem[] = curriculumRows
    .filter((r) => !freshKeys.has(norm(r.word)) && !userSaved.has(norm(r.word)))
    .map((r) => ({
      word: r.word,
      translation: r.translation,
      wordType: r.wordType,
      exampleSentence: r.exampleSentence,
      storySlug: r.storySlug,
      storyTitle: r.storyTitle,
      sourcePath: r.sourcePath,
      language: r.language,
      nextReviewAt: r.nextReviewAt ? r.nextReviewAt.toISOString() : null,
      lastReviewedAt: r.lastReviewedAt ? r.lastReviewedAt.toISOString() : null,
      streak: r.streak,
      practiceSource: "curriculum" as const,
    }));

  const items = mergePracticeItemsByWord([...fresh, ...tracked]) as PoolItem[];
  return NextResponse.json({
    items: signAudioUrlsDeep(items),
    freshStories: recent.map((s) => s.slug),
  });
}
