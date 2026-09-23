export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { books } from "@/data/books";
import { prisma } from "@/lib/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getEffectivePlanForUserId, isFirstTopicStorySlug } from "@/lib/effectiveAccess";
import { isDailyStorySlug } from "@/lib/dailyJourneyStory";
import { isEntitledPlan } from "@domain/access";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import { getJourneyStoryBySlug } from "@/lib/journeyStories";
import { getCreateStoryMirrorBySlug } from "@/lib/userStories";
import { buildPracticeItemsFromStory, parseLooseVocab } from "@/lib/storyPracticeItems";
import { buildPracticeSession, mergePracticeItemsByWord, type PracticeExercise, type PracticeFavoriteItem } from "@/lib/practiceExercises";
import { loadPersistedExercises, loadSentenceTranslations } from "@/lib/persistedPracticeExercises";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import type { AudioWordTimingsPayload } from "@domain";
import { signAudioUrlsDeep } from "@/lib/mediaSigning";

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
  // Sólo por slug único: el slug se repite entre libros del catálogo
  // (`el-vendedor-ambulante`), y servir los timings de otra historia sería
  // peor que no servir ninguno.
  const conEseSlug = await prisma.catalogStory.count({ where: { slug } });
  if (conEseSlug > 1) return null;
  const catalogRow = await prisma.catalogStoryAudioTimings.findFirst({
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

  // Muro 2026-09: la practica de una historia solo se sirve si la historia
  // misma es accesible para el plan efectivo (tema 1, historia del dia, o
  // plan con derecho).
  const effectivePlan = await getEffectivePlanForUserId(userId);
  if (!isEntitledPlan(effectivePlan)) {
    const [firstTopic, daily] = await Promise.all([
      isFirstTopicStorySlug(storySlug),
      isDailyStorySlug(storySlug),
    ]);
    if (!firstTopic && !daily) {
      return NextResponse.json({ error: "PLAN_REQUIRED" }, { status: 403 });
    }
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

  // Traducciones de frase de la historia, el MAPA entero en cada item, igual
  // que en /api/mobile/favorites: el cliente no sabe aqui que frase acabara
  // pintando el ejercicio hablado, y sin el mapa el resultado sale sin
  // `MEANING` aunque la tanda de traducciones exista.
  const sentenceTranslations = await loadSentenceTranslations(storySlug);
  const items = mergePracticeItemsByWord([...storyItems, ...savedItems]).map((item) => ({
    ...item,
    sentenceTranslations,
  }));

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

  // Palabras guardadas desde el quick lookup que el set curado NO cubre.
  //
  // Los clientes prefieren `exercises` en cuanto existe un set curado, y esa
  // rama SUSTITUYE por completo a la que se construye desde `items`. Resultado:
  // las palabras que el usuario guarda tocando el texto viajaban en `items`
  // pero nadie las convertía en ejercicio, así que solo se podían practicar las
  // del vocabulario curado. Aquí se generan las que faltan y se añaden al POOL
  // (el "practica el resto"), nunca a los ~10 destacados: esos están calibrados
  // editorialmente y diluirlos cambiaría la sesión de fin de historia.
  const savedOnlyExercises = await buildExercisesForUncuratedSavedWords(
    storySlug,
    savedItems,
    storyItems
  );
  poolCount += savedOnlyExercises.length;
  const nextStory = await resolveNextStory(storySlug);

  // narratorVoiceId: the story's own narrator, so the practice page renders the
  // isolated-word audio in the story's country accent (see lib/practiceVoice.ts).
  // Solo el pool las sirve. En modo destacado `persistedExercises` sale intacto
  // y lo único que cambia es `poolCount`, que es lo que hace aparecer el botón
  // de "practica el resto" aunque la historia no tuviera pool curado.
  const exercises = poolMode
    ? [...(persistedExercises ?? []), ...savedOnlyExercises]
    : persistedExercises;

  return NextResponse.json({
    items: signAudioUrlsDeep(items),
    exercises:
      exercises && exercises.length > 0 ? signAudioUrlsDeep(exercises) : undefined,
    poolCount,
    nextStory,
    narratorVoiceId: storyVoiceId,
  });
}

/**
 * Ejercicios para las palabras que el usuario guardó en ESTA historia y que el
 * set curado no toca (típicamente las del quick lookup).
 *
 * Devuelve [] cuando la historia no tiene set curado: ahí los clientes ya caen
 * a construir desde `items`, que incluye las guardadas, así que no hay nada que
 * rellenar. La cobertura se mide contra las palabras de los ejercicios
 * PERSISTIDOS (destacados + pool), no contra el vocab de la historia, porque es
 * lo que el usuario ve realmente.
 */
async function buildExercisesForUncuratedSavedWords(
  storySlug: string,
  savedItems: PracticeFavoriteItem[],
  distractorPool: PracticeFavoriteItem[]
): Promise<PracticeExercise[]> {
  if (!storySlug || savedItems.length === 0) return [];
  try {
    const curated = await prisma.storyPracticeExercise.findMany({
      where: { set: { story: { slug: storySlug, status: "published" } } },
      select: { word: true },
    });
    if (curated.length === 0) return [];

    const covered = new Set(
      curated
        .map((row) => normalizeWordKey(row.word))
        .filter((word) => word.length > 0)
    );
    const missing = savedItems.filter((item) => !covered.has(normalizeWordKey(item.word)));
    if (missing.length === 0) return [];

    // Los distractores salen del pool del MISMO idioma. Con la palabra suelta
    // como única fuente no hay ninguno (el catálogo interno no cubre alemán) y
    // el generador devuelve null: medido, 0 ejercicios. Se acompaña del vocab
    // de la historia, y se generan de una en una con pocos acompañantes para
    // no rozar el tope de 10 que aplica el generador, que si no podría dejar
    // fuera justo la palabra guardada.
    const companions = distractorPool.filter((item) => (item.translation ?? "").trim().length > 0);

    const out: PracticeExercise[] = [];
    for (const item of missing) {
      const key = normalizeWordKey(item.word);
      if (!key) continue;
      const others = companions.filter((c) => normalizeWordKey(c.word) !== key).slice(0, 6);
      const source = [item, ...others];
      // meaning primero: es el modo que mejor encaja con una palabra que el
      // usuario tocó para entenderla. Si no sale (pide una oración de ejemplo
      // completa, y muchas guardadas no la traen), listening solo necesita
      // palabras distractoras.
      const built =
        findExerciseForWord(buildPracticeSession(source, "meaning"), key) ??
        findExerciseForWord(buildPracticeSession(source, "listening"), key);
      // Prefijo para no colisionar nunca con un id de ejercicio persistido.
      if (built) out.push({ ...built, id: `saved-${built.id}` });
    }
    return out;
  } catch {
    // El pool extra es un añadido: si falla, la práctica curada sigue igual.
    return [];
  }
}

function normalizeWordKey(value?: string | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findExerciseForWord(
  exercises: PracticeExercise[],
  wordKey: string
): PracticeExercise | null {
  for (const exercise of exercises) {
    if (exercise.type === "meaning_in_context" && normalizeWordKey(exercise.word) === wordKey) {
      return exercise;
    }
    if (exercise.type === "listen_choose" && normalizeWordKey(exercise.answer) === wordKey) {
      return exercise;
    }
  }
  return null;
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

