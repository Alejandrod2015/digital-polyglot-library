import { unstable_cache } from "next/cache";
import { resolveContentVariant } from "@/lib/languageVariant";
import type { CefrLevel, Level } from "@/types/books";
import { getJourneyFocusFromLearningGoal, normalizeJourneyFocus, type JourneyFocus } from "@/lib/onboarding";
import {
  getStudioStandaloneStoryBySlug,
  getStudioStandaloneStoriesBySlugs,
  getStudioStandaloneStoriesByIds,
  getAllPublishedStudioStandaloneStories,
  getJourneyEligibleStudioStandaloneStories,
  type RawStandaloneStory,
} from "@/lib/catalog";

export type PublicStandaloneStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocabRaw: string | null;
  theme: string[];
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  focus: string | null;
  journeyFocus: JourneyFocus | null;
  topic: string | null;
  journeyEligible: boolean | null;
  journeyTopic: string | null;
  journeyOrder: number | null;
  coverUrl: string | null;
  coverThumbhash: string | null;
  audioUrl: string | null;
  /** Narration voiceId stored in DB (Studio journeys only). When set,
   *  practice TTS uses this voice instead of the language default. */
  voiceId: string | null;
  createdAt: string;
};

type GetPublishedStandaloneStoriesOptions = {
  includeJourneyStories?: boolean;
};

const legacyLevelFallback: Record<Level, CefrLevel> = {
  beginner: "a1",
  intermediate: "b1",
  advanced: "c1",
};

function normalizeStandaloneStory(
  story: PublicStandaloneStory | RawStandaloneStory
): PublicStandaloneStory {
  const resolvedLevel =
    typeof story.level === "string" &&
    ["beginner", "intermediate", "advanced"].includes(story.level)
      ? (story.level as Level)
      : null;

  return {
    ...story,
    variant:
      resolveContentVariant({
        language: story.language,
        variant: story.variant,
        region: story.region,
      }) ?? null,
    cefrLevel:
      story.cefrLevel ??
      (resolvedLevel ? legacyLevelFallback[resolvedLevel] : null),
    journeyFocus:
      normalizeJourneyFocus(story.journeyFocus) ??
      getJourneyFocusFromLearningGoal(null),
  };
}

const getPublishedStandaloneStoriesCached = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    const rows = await getAllPublishedStudioStandaloneStories();
    return rows.map(normalizeStandaloneStory);
  },
  ["published-standalone-stories-v2"],
  { revalidate: 60, tags: ["published-standalone-stories"] }
);

async function getPublishedJourneyStandaloneStories(): Promise<PublicStandaloneStory[]> {
  const rows = await getJourneyEligibleStudioStandaloneStories();
  return rows.map(normalizeStandaloneStory);
}

export function isJourneyAssignedStandaloneStory(
  story: Pick<PublicStandaloneStory, "journeyEligible" | "journeyTopic" | "journeyOrder">
) {
  if (story.journeyEligible === true) {
    return true;
  }

  if (typeof story.journeyTopic === "string" && story.journeyTopic.trim() !== "") {
    return true;
  }

  return typeof story.journeyOrder === "number" && Number.isFinite(story.journeyOrder);
}

export async function getPublishedStandaloneStories(
  options: GetPublishedStandaloneStoriesOptions = {}
): Promise<PublicStandaloneStory[]> {
  if (options.includeJourneyStories) {
    const [studioStories, prismaJourneyStories] = await Promise.all([
      getPublishedJourneyStandaloneStories(),
      // Dynamic import avoids a circular dependency (journeyStories imports
      // PublicStandaloneStory from this module).
      import("@/lib/journeyStories").then((m) => m.getPublishedJourneyStories()),
    ]);
    const seen = new Set(studioStories.map((story) => story.slug));
    const merged = [...studioStories];
    for (const story of prismaJourneyStories) {
      if (seen.has(story.slug)) continue;
      merged.push(story);
    }
    return merged;
  }

  const stories = await getPublishedStandaloneStoriesCached();
  return stories.filter((story) => !isJourneyAssignedStandaloneStory(story));
}

export async function getStandaloneStoryBySlug(
  slug: string
): Promise<PublicStandaloneStory | null> {
  const raw = await getStudioStandaloneStoryBySlug(slug);
  return raw ? normalizeStandaloneStory(raw) : null;
}

export async function getStandaloneStoriesByIds(
  ids: string[]
): Promise<PublicStandaloneStory[]> {
  if (ids.length === 0) return [];
  const stories = (await getStudioStandaloneStoriesByIds(ids)).map(normalizeStandaloneStory);

  // Lo que la app guarda con el marcador desde un journey no está en el catálogo
  // standalone: vive en `JourneyStory`, y además puede venir por slug o por
  // `journey-<cuid>`. Sin este rescate la fila existe en la biblioteca del
  // usuario pero se queda sin slug ni idioma, o sea sin enlace que abrir, que es
  // exactamente el fallo silencioso que ya tuvimos en la pantalla de Saved.
  const resolvedIds = new Set(stories.map((story) => story.id));
  const missing = ids.filter((id) => !resolvedIds.has(id));
  if (missing.length === 0) return stories;

  const { getJourneyStoryByIdOrSlug } = await import("@/lib/journeyStories");
  const rescued = (await Promise.all(missing.map((id) => getJourneyStoryByIdOrSlug(id)))).filter(
    (story): story is PublicStandaloneStory => Boolean(story)
  );

  return [...stories, ...rescued];
}

export async function getStandaloneStoriesBySlugs(
  slugs: string[]
): Promise<PublicStandaloneStory[]> {
  if (slugs.length === 0) return [];

  const studioStories = (await getStudioStandaloneStoriesBySlugs(slugs)).map(
    normalizeStandaloneStory
  );

  // Also resolve slugs from Prisma JourneyStory rows; stories created in the
  // Studio live there, not in the standalone catalog, and the reader needs
  // them to open.
  const foundSlugs = new Set(studioStories.map((s) => s.slug));
  const missingSlugs = slugs.filter((s) => !foundSlugs.has(s));
  if (missingSlugs.length === 0) return studioStories;

  const { getJourneyStoryBySlug } = await import("@/lib/journeyStories");
  const prismaStories = (
    await Promise.all(missingSlugs.map((slug) => getJourneyStoryBySlug(slug)))
  ).filter((story): story is PublicStandaloneStory => Boolean(story));

  return [...studioStories, ...prismaStories];
}
