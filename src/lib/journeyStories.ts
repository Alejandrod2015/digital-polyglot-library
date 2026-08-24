import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PublicStandaloneStory } from "@/lib/standaloneStories";

/**
 * Converts a JourneyStory from PostgreSQL into PublicStandaloneStory shape
 * so the reader can display it identically to Sanity stories.
 */
function toPublicStory(s: {
  id: string;
  slug: string | null;
  title: string | null;
  text: string | null;
  synopsis: string | null;
  vocab: any;
  level: string;
  topic: string;
  coverDone: boolean;
  coverUrl: string | null;
  coverThumbhash: string | null;
  audioUrl: string | null;
  voiceId: string | null;
  journey: { language: string; variant: string };
  createdAt: Date;
}): PublicStandaloneStory {
  return {
    id: `journey-${s.id}`,
    slug: s.slug || s.id,
    title: s.title || "Untitled",
    text: s.text || "",
    vocabRaw: s.vocab ? JSON.stringify(
      Array.isArray(s.vocab)
        ? (s.vocab as any[]).map((v: any) => ({
            word: v.word ?? "",
            definition: v.definition ?? v.translation ?? "",
            ...(v.type ? { type: v.type } : {}),
            ...(v.register ? { register: v.register } : {}),
            ...(v.surface ? { surface: v.surface } : {}),
          }))
        : s.vocab
    ) : null,
    theme: [s.topic],
    language: s.journey.language,
    variant: s.journey.variant,
    region: s.journey.variant,
    level: s.level,
    cefrLevel: s.level,
    focus: null,
    journeyFocus: null,
    topic: s.topic,
    journeyEligible: true,
    journeyTopic: s.topic,
    journeyOrder: null,
    coverUrl: s.coverUrl ?? null,
    coverThumbhash: s.coverThumbhash ?? null,
    audioUrl: s.audioUrl ?? null,
    voiceId: s.voiceId ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * Get all published journey stories from PostgreSQL.
 * Cached for 60s with ISR revalidation.
 */
export const getPublishedJourneyStories = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    try {
      const stories = await prisma.journeyStory.findMany({
        where: { status: "published" },
        include: { journey: { select: { language: true, variant: true } } },
        orderBy: { createdAt: "desc" },
      });
      return stories.filter((s) => s.text && s.title).map(toPublicStory);
    } catch {
      return [];
    }
  },
  ["published-journey-stories-v2"],
  // 5-minute soft cache; publish flow calls revalidateTag() so fresh
  // content still appears immediately when a story is published; the
  // longer window just avoids refetching for every reader request when
  // nothing changed.
  { revalidate: 300, tags: ["published-journey-stories"] }
);

/**
 * Filtro de estado del lector. Se comparte entre las búsquedas por slug y por
 * id para que una historia en borrador NO se cuele en producción por haber
 * entrado por la otra puerta.
 */
function readerStatusWhere() {
  // Local preview only (NODE_ENV !== production): also resolve draft stories
  // that belong to an in-progress journey, so it can be read in the REAL story
  // reader before publishing. Production stays published-only.
  //
  // A list, not a single id, so several journeys can be in progress at once
  // (2026-07-09: added Friends ES C1 LATAM alongside the German A0).
  // NOTE: the reader does NOT filter by Journey.status; a story with
  // status:"published" is reachable by direct URL in production even when its
  // journey is "archived". Keep in-progress journeys' stories in "draft" and
  // preview them via this list instead of publishing them.
  const PREVIEW_JOURNEY_IDS = [
      "cmsyrge55000732u9oiu8wue3", // Traveler PT-BR A1 (en obra, 2026-08)
      "cmt0a8vb1000m32p1x7r5ba28", // Traveler DE A0 germany (en obra, 2026-08)
      "cmrdqk484000032r4rt2vw4ej", // Friends ES C1 LATAM (in progress)
      "cmrdbz11t000032asrvo832i9", // Hanseat DE C1 (in progress; un-published 2026-07-09)
      "cmraj8ihq000032a6sghnrim9", // Traveler FR A0 Biarritz (archived; un-published 2026-07-09)
      "cmroo4w4v0000324ow1o9qlcp", // Friends DE C1 germany (in progress)
      "cmrpm0tra000032vgxcs33wrb", // Friends ES C1 colombia (in progress)
      "cmrqn1s5s000032tj3kq0gykb", // Friends ES C1 argentina (in progress)
      "cmrr5hnbl000032k1esry5n8g", // Friends ES A0 spain (in progress)
      "cmrrqjd2n000032nvnp2tryzg", // Traveler ES A0 mexico (in progress)
      "cmrrrpru1000032nnzsmraa7h", // Friends ES C1 mexico (in progress)
      "cmrsiz1n40000320d6h8p8f5g", // Friends IT A0 italy (in progress)
    "cmss0fkc40007j8dub1zpa1kc", // Traveler IT A0 italy (in progress)
    "cmsvz6mz9000732gsgsfer0ko", // Friends ES A1 spain (in progress)
    "cmt09ehi60000320qf9efrypu", // Expat FR A0 lyon (en obra, 2026-08)
    "cmt70xfyt000l3283gxd70wck", // Traveler ES A2 spain (en obra, 2026-08)
  ];
  return process.env.NODE_ENV !== "production"
    ? { OR: [{ status: "published" as const }, { journeyId: { in: PREVIEW_JOURNEY_IDS } }] }
    : { status: "published" as const };
}

/**
 * Get a single published journey story by slug.
 */
export async function getJourneyStoryBySlug(
  slug: string
): Promise<PublicStandaloneStory | null> {
  try {
    const story = await prisma.journeyStory.findFirst({
      where: { slug, ...readerStatusWhere() },
      include: { journey: { select: { language: true, variant: true } } },
    });
    if (!story || !story.text || !story.title) return null;
    return toPublicStory(story);
  } catch {
    return null;
  }
}

/**
 * Igual que `getJourneyStoryBySlug` pero aceptando CUALQUIERA de las formas con
 * las que esta historia circula, porque no hay una sola: el endpoint de journey
 * emite `journey:<cuid>`, el de historias sueltas `journey-<cuid>`, y lo que la
 * app guarda con el marcador es el SLUG. Un `LibraryStory` puede traer
 * cualquiera de las tres, así que se buscan todas en vez de exigir la correcta.
 */
export async function getJourneyStoryByIdOrSlug(
  value: string
): Promise<PublicStandaloneStory | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const bySlug = await getJourneyStoryBySlug(trimmed);
  if (bySlug) return bySlug;

  const bareId = trimmed.replace(/^journey[:-]/, "");
  if (bareId === trimmed) return null;
  try {
    const story = await prisma.journeyStory.findFirst({
      where: { id: bareId, ...readerStatusWhere() },
      include: { journey: { select: { language: true, variant: true } } },
    });
    if (!story || !story.text || !story.title) return null;
    return toPublicStory(story);
  } catch {
    return null;
  }
}
