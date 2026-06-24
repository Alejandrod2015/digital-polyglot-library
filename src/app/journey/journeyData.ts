import { unstable_cache } from "next/cache";
import {
  CEFR_LEVEL_LABELS,
  type CefrLevel,
  type VocabItem,
} from "@/types/books";
import type { PracticeFavoriteItem } from "@/lib/practiceExercises";
import { formatVariantLabel, resolveContentVariant } from "@/lib/languageVariant";
import { getPublishedStandaloneStories } from "@/lib/standaloneStories";
import { normalizeJourneyFocus, type JourneyFocus } from "@/lib/onboarding";
import { getJourneyCurriculumPlans, getJourneyLevelPlanAsync } from "@/lib/journeyCurriculumSource";
import { prisma } from "@/lib/prisma";

export type JourneyStoryItem = {
  id: string;
  progressKey: string;
  storySlug: string;
  sourcePath: string;
  title: string;
  href: string;
  coverUrl?: string;
  language?: string;
  region?: string;
  variant?: string;
  journeyFocus?: JourneyFocus;
  levelLabel: string;
  topicLabel: string;
  text?: string;
  vocabItems?: VocabItem[];
};

export type JourneyTopic = {
  id: string;
  slug: string;
  label: string;
  storyCount: number;
  storyTarget?: number;
  stories: JourneyStoryItem[];
};

export type JourneyLevel = {
  id: string;
  title: string;
  subtitle: string;
  topics: JourneyTopic[];
};

export type JourneyVariantTrack = {
  id: string;
  /** Human-readable slug usado en la URL (?variant=viajero-latam) en
   *  lugar del cuid feo (cmovi4cvi000032q37a4823h3). Derivado del
   *  nombre del Journey + variant, único por language. Para uso
   *  interno (lookups en memoria) seguimos usando `id`. */
  slug: string;
  label: string;
  /** Journey.language ("German", "Spanish", "Italian", ...). Usado
   *  como fallback para resolver el pill code/flag en el top bar
   *  cuando `variant` no matchea el mapa (p.ej. variant="german"
   *  caía al fallback `.slice(0,2)` y mostraba "GE"). */
  language: string | null;
  /** Studio Journey.variant (e.g. "latam", "spain", "br", "pt"). Used
   *  client-side to pick the flag when the user's stored Journey only
   *  has the cuid in `variant` and never persisted a separate region. */
  variant: string | null;
  levels: JourneyLevel[];
};

export type JourneyReviewLaneTopic = {
  levelId: string;
  levelTitle: string;
  topicSlug: string;
  topicLabel: string;
  dueCount: number;
  complete: boolean;
  practiced: boolean;
  checkpointPassed: boolean;
};

export type JourneyTrackInsights = {
  score: number;
  completedSteps: number;
  totalSteps: number;
  completedRequiredStories: number;
  totalRequiredStories: number;
  practicedTopicCount: number;
  totalTopicCount: number;
  passedCheckpointCount: number;
  totalCheckpointCount: number;
  dueReviewCount: number;
  dueTopicCount: number;
  reviewTopics: JourneyReviewLaneTopic[];
  currentLevelId: string | null;
  currentLevelTitle: string | null;
  nextMilestone: string;
};

export type JourneyCheckpointQuestion = {
  id: string;
  kind: "meaning" | "context" | "listening" | "natural_usage";
  word: string;
  prompt: string;
  stem?: string;
  options: string[];
  answer: string;
  ttsText?: string;
};

export function getJourneyProgressKeyFromSource(
  sourcePath?: string | null,
  storySlug?: string | null
): string | null {
  const normalizedPath = typeof sourcePath === "string" ? sourcePath.trim() : "";
  const normalizedSlug = typeof storySlug === "string" ? storySlug.trim() : "";
  if (!normalizedPath || !normalizedSlug) return null;

  if (normalizedPath.startsWith("/books/")) {
    return normalizedPath.replace(/^\/books\//, "").replace(/\//g, ":");
  }

  if (normalizedPath.startsWith("/stories/")) {
    return `standalone:${normalizedSlug}`;
  }

  return null;
}

// Las funciones puras de unlock viven en src/lib/journeyUnlock para
// que web (este módulo) y mobile compartan exactamente la misma lógica
// y mantengamos una sola fuente de verdad de la política de
// desbloqueo.
import {
  isJourneyStoryComplete,
  getJourneyTopicRequiredStoryCount,
  getJourneyTopicCompletedStoryCount,
  isJourneyTopicComplete,
  isTopicGating,
} from "@/lib/journeyUnlock";
export {
  isJourneyStoryComplete,
  getJourneyTopicRequiredStoryCount,
  getJourneyTopicCompletedStoryCount,
  isJourneyTopicComplete,
  isTopicGating,
};

export function getUnlockedTopicCount(
  level: Pick<JourneyLevel, "topics">,
  completedStoryKeys: Set<string>,
  passedCheckpointKeys?: Set<string>,
  variantId?: string,
  levelId?: string
): number {
  if (level.topics.length === 0) return 0;

  let unlockedCount = 1;
  for (let index = 0; index < level.topics.length - 1; index += 1) {
    const topic = level.topics[index];
    if (isTopicGating(topic)) {
      if (!isJourneyTopicComplete(topic, completedStoryKeys)) break;
      if (passedCheckpointKeys && levelId) {
        const checkpointKey = getJourneyTopicCheckpointKey(variantId, levelId, topic.slug);
        if (!passedCheckpointKeys.has(checkpointKey)) break;
      }
    }
    // Empty topic: doesn't gate progression — advance freely.
    unlockedCount += 1;
  }
  return Math.min(unlockedCount, level.topics.length);
}

// Re-export desde el módulo compartido. La política (75% threshold,
// topic gating, etc.) vive en src/lib/journeyUnlock para que mobile
// y web no se desincronicen al cambiarla.
export { isJourneyLevelComplete, getUnlockedLevelCount } from "@/lib/journeyUnlock";

export function getUnlockedStoryCount(
  topic: Pick<JourneyTopic, "stories" | "storyTarget">,
  completedStoryKeys: Set<string>
): number {
  if (topic.stories.length === 0) return 0;
  if (isJourneyTopicComplete(topic, completedStoryKeys)) return topic.stories.length;

  let unlockedCount = 1;
  for (let index = 0; index < topic.stories.length - 1; index += 1) {
    if (!isJourneyStoryComplete(topic.stories[index], completedStoryKeys)) break;
    unlockedCount += 1;
  }
  return Math.min(unlockedCount, topic.stories.length);
}

import { getJourneyTopicCheckpointKey } from "@/lib/journeyUnlock";
export { getJourneyTopicCheckpointKey };

export function getJourneyTopicPracticeKey(
  variantId: string | undefined,
  levelId: string,
  topicSlug: string
): string {
  return `${variantId ?? "default"}:${levelId}:${topicSlug}`;
}

const journeyLevelMeta: Record<CefrLevel, { id: string; title: string; subtitle: string }> = {
  a0: { id: "a0", title: "A0", subtitle: "Start from zero" },
  a1: { id: "a1", title: "A1", subtitle: "First steps" },
  a2: { id: "a2", title: "A2", subtitle: "Building confidence" },
  b1: { id: "b1", title: "B1", subtitle: "Everyday confidence" },
  b2: { id: "b2", title: "B2", subtitle: "Richer expression" },
  c1: { id: "c1", title: "C1", subtitle: "Nuanced language" },
  c2: { id: "c2", title: "C2", subtitle: "Near-native command" },
};

const DEFAULT_LANGUAGE = "Spanish";
const DEFAULT_VARIANT_ORDER = ["latam", "spain", "us", "uk", "brazil", "portugal", "germany", "austria", "france", "canada-fr", "italy"];
export {
  JOURNEY_LEVEL_IDS,
  normalizeJourneyPlacementLevel,
  getJourneyPlacementLevelIndex,
} from "@/lib/journeyUnlock";
import { JOURNEY_LEVEL_IDS } from "@/lib/journeyUnlock";

function slugifyTopic(topic: string) {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortVariants(a: string, b: string) {
  const aIndex = DEFAULT_VARIANT_ORDER.indexOf(a);
  const bIndex = DEFAULT_VARIANT_ORDER.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function parseStandaloneVocabRaw(vocabRaw: string | null): VocabItem[] {
  if (typeof vocabRaw !== "string" || vocabRaw.trim() === "") return [];

  try {
    const parsed = JSON.parse(vocabRaw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const items: VocabItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const word = typeof record.word === "string" ? record.word.trim() : "";
      const definition = typeof record.definition === "string" ? record.definition.trim() : "";
      const type = typeof record.type === "string" ? record.type.trim() : "";
      const note = typeof record.note === "string" ? record.note.trim() : "";
      if (!word || !definition) continue;
      items.push({
        word,
        definition,
        type: type || undefined,
        note: note || undefined,
      });
    }

    return items;
  } catch {
    return [];
  }
}

function getJourneyFocusPriority(
  storyFocus: JourneyFocus | undefined,
  activeFocus: JourneyFocus
): number {
  const normalizedStoryFocus = normalizeJourneyFocus(storyFocus) ?? "General";
  if (normalizedStoryFocus === activeFocus) return 3;
  if (normalizedStoryFocus === "General") return 2;
  return 1;
}

function collapseJourneyStoryAlternatives(
  stories: Array<JourneyStoryItem & { journeyOrder?: number | null }>,
  activeFocus: JourneyFocus
): JourneyStoryItem[] {
  const groupedBySlot = new Map<string, Array<JourneyStoryItem & { journeyOrder?: number | null }>>();

  for (const story of stories) {
    const slotKey =
      typeof story.journeyOrder === "number" && Number.isFinite(story.journeyOrder)
        ? `order:${story.journeyOrder}`
        : `story:${story.id}`;
    const current = groupedBySlot.get(slotKey) ?? [];
    current.push(story);
    groupedBySlot.set(slotKey, current);
  }

  return Array.from(groupedBySlot.entries())
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey, undefined, { numeric: true }))
    .map(([, candidates]) =>
      [...candidates]
        .sort((a, b) => {
          const focusDiff = getJourneyFocusPriority(b.journeyFocus, activeFocus) - getJourneyFocusPriority(a.journeyFocus, activeFocus);
          if (focusDiff !== 0) return focusDiff;
          const aOrder = typeof a.journeyOrder === "number" ? a.journeyOrder : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.journeyOrder === "number" ? b.journeyOrder : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.title.localeCompare(b.title);
        })[0]
    );
}

async function buildLevelsForVariant(
  language: string,
  variantId: string,
  journeyFocus: JourneyFocus = "General"
): Promise<JourneyLevel[]> {
  const grouped = new Map<string, Map<string, Array<JourneyStoryItem & { journeyOrder?: number | null }>>>();
  const standaloneStories = await getPublishedStandaloneStories({ includeJourneyStories: true });

  for (const story of standaloneStories) {
    if ((story.language ?? "").trim().toLowerCase() !== language.trim().toLowerCase()) continue;
    if (!story.journeyEligible || !story.journeyTopic) continue;
    if ((story.variant ?? "").trim().toLowerCase() !== variantId) continue;
    const resolvedCefrLevel = (story.cefrLevel ?? "").trim().toLowerCase() as CefrLevel;
    const mappedLevel = journeyLevelMeta[resolvedCefrLevel];
    if (!mappedLevel) continue;

    if (!grouped.has(mappedLevel.id)) {
      grouped.set(mappedLevel.id, new Map());
    }

    const targetTopics = grouped.get(mappedLevel.id)!;
    const topicSlug = story.journeyTopic.trim().toLowerCase();
    const curriculumLevel = await getJourneyLevelPlanAsync(language, variantId, mappedLevel.id);
    const topicPlan = curriculumLevel?.topics.find((topic) => topic.slug === topicSlug) ?? null;
    const topicLabel =
      topicPlan?.label ??
      topicSlug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

    // Key the inner map by slug (not label) so the curriculum match later is direct
    // and survives labels whose slugify round-trip doesn't match the curriculum slug.
    if (!targetTopics.has(topicSlug)) {
      targetTopics.set(topicSlug, []);
    }

    const storyItem = {
      id: `standalone:${story.slug}`,
      progressKey: `standalone:${story.slug}`,
      storySlug: story.slug,
      sourcePath: `/stories/${story.slug}`,
      title: story.title,
      href: `/stories/${story.slug}`,
      coverUrl: story.coverUrl ?? undefined,
      language: story.language ?? undefined,
      region: story.region ?? undefined,
      variant: story.variant ?? undefined,
      journeyFocus: normalizeJourneyFocus(story.journeyFocus) ?? "General",
      levelLabel: CEFR_LEVEL_LABELS[resolvedCefrLevel],
      topicLabel,
      text: story.text,
      vocabItems: parseStandaloneVocabRaw(story.vocabRaw),
    } satisfies JourneyStoryItem & { journeyOrder?: number | null };

    const withOrder = { ...storyItem, journeyOrder: story.journeyOrder };
    targetTopics.get(topicSlug)!.push(withOrder);
  }

  // Topic ORDER = single source of truth en `Journey.topics` (DB), el mismo
  // array que usa el journey-manager. El curriculum (journeyCurriculum.ts) puede
  // quedar viejo respecto a los temas reales del journey reestructurado, así que
  // reordenamos la lista final de temas por `Journey.topics` para que la home
  // coincida 1:1 con el manager. (2026-06-11)
  const journeyForOrder = await prisma.journey.findFirst({
    where: { language: { equals: language, mode: "insensitive" }, variant: variantId },
    orderBy: { createdAt: "asc" },
    select: { topics: true },
  });
  const topicOrder = new Map<string, number>();
  (journeyForOrder?.topics ?? []).forEach((slug, i) => topicOrder.set(slug, i));

  const levels: JourneyLevel[] = [];
  for (const [, meta] of Object.entries(journeyLevelMeta)) {
      const topicsMap = grouped.get(meta.id) ?? new Map<string, JourneyStoryItem[]>();
      const curriculumLevel = await getJourneyLevelPlanAsync(language, variantId, meta.id);
      // The inner Map is now keyed by slug (the story's journeyTopic slug), so the slug
      // here is authoritative — no lossy slugify(label) round-trip.
      const rawTopics: JourneyTopic[] = Array.from(topicsMap.entries()).map(([slug, stories]) => {
        const topicPlan = curriculumLevel?.topics.find((topic) => topic.slug === slug) ?? null;
        const label =
          topicPlan?.label ??
          slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
        const sortedStories = [...stories].sort((a, b) => {
          const aOrder =
            typeof (a as JourneyStoryItem & { journeyOrder?: number | null }).journeyOrder === "number"
              ? ((a as JourneyStoryItem & { journeyOrder?: number | null }).journeyOrder as number)
              : Number.MAX_SAFE_INTEGER;
          const bOrder =
            typeof (b as JourneyStoryItem & { journeyOrder?: number | null }).journeyOrder === "number"
              ? ((b as JourneyStoryItem & { journeyOrder?: number | null }).journeyOrder as number)
              : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.title.localeCompare(b.title);
        });
        const selectedStories = collapseJourneyStoryAlternatives(sortedStories, journeyFocus);
        return {
          id: `${meta.id}:${slug}`,
          slug,
          label,
          storyCount: selectedStories.length,
          storyTarget: topicPlan?.storyTarget,
          stories: selectedStories,
        } satisfies JourneyTopic;
      });

      let topics: JourneyTopic[];
      if (curriculumLevel) {
        // Only surface curriculum topics that actually have stories. Empty
        // curriculum slots were creating noise ("Coming soon" rows that
        // never went anywhere). Custom Studio topics are always included
        // when they have stories.
        const curriculumTopics: JourneyTopic[] = [];
        for (const topicPlan of curriculumLevel.topics) {
          const existingTopic = rawTopics.find((topic) => topic.slug === topicPlan.slug);
          if (!existingTopic) continue;
          curriculumTopics.push({
            ...existingTopic,
            storyTarget: topicPlan.storyTarget,
          });
        }
        const curriculumSlugs = new Set(curriculumLevel.topics.map((t) => t.slug));
        const customTopics = rawTopics.filter((t) => !curriculumSlugs.has(t.slug));
        topics = [...curriculumTopics, ...customTopics];
      } else {
        topics = rawTopics.slice().sort((a, b) => {
          if (b.storyCount !== a.storyCount) return b.storyCount - a.storyCount;
          return a.label.localeCompare(b.label);
        });
      }

      // Orden final por `Journey.topics` (DB) — fuente única compartida con el
      // journey-manager. Los temas ausentes del array conservan su orden previo
      // (sort estable) después de los conocidos.
      if (topicOrder.size > 0) {
        topics = topics
          .map((t, i) => ({ t, i }))
          .sort((a, b) => {
            const ao = topicOrder.has(a.t.slug) ? topicOrder.get(a.t.slug)! : Number.MAX_SAFE_INTEGER;
            const bo = topicOrder.has(b.t.slug) ? topicOrder.get(b.t.slug)! : Number.MAX_SAFE_INTEGER;
            if (ao !== bo) return ao - bo;
            return a.i - b.i;
          })
          .map((x) => x.t);
      }

      const level = {
        id: meta.id,
        title: curriculumLevel?.title ?? meta.title,
        subtitle: curriculumLevel?.subtitle ?? meta.subtitle,
        topics,
      } satisfies JourneyLevel;

      // Only include the level if at least one topic has stories. An empty
      // level would render as a locked placeholder with nothing behind it.
      if (level.topics.length > 0) {
        levels.push(level);
      }
  }

  return levels;
}

function prettifyTopicLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Build journey tracks from Prisma Journey records (Studio-created content).
 * Studio is the source of truth: only levels, topics and stories configured
 * there show up in the reader. Returns an empty array when there is no
 * Studio content for the language — the caller falls back to legacy.
 */
// Cached Prisma read. Pair with revalidateTag("published-journey-stories")
// — already fired by /api/studio/journeys/publish — so newly published
// content appears immediately while the reader avoids a round trip on
// every request.
const getStudioJourneysForLanguage = unstable_cache(
  async (language: string) => {
    return prisma.journey.findMany({
      where: {
        language: { equals: language, mode: "insensitive" },
        status: { not: "archived" },
      },
      // Deterministic order across Journey records for a variant so the UI
      // shows them the same way every time.
      orderBy: { createdAt: "asc" },
      include: {
        stories: {
          where: { status: "published", NOT: [{ text: null }, { title: null }] },
          // Include `topic` in the order so stories with the same level/slot
          // don't get shuffled between topics; `slotIndex` is the sequence
          // within a topic, as assigned by the Studio creation flow.
          orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
        },
      },
    });
  },
  ["studio-journeys-by-language-v5"],
  { revalidate: 300, tags: ["published-journey-stories"] }
);

// Mismo query pero sin filtro de language. Usado cuando el usuario
// no tiene preference de idioma (selected = []) y queremos exponerle
// TODOS los journeys disponibles en el sheet "Switch journey".
const getAllStudioJourneys = unstable_cache(
  async () => {
    return prisma.journey.findMany({
      where: { status: { not: "archived" } },
      orderBy: [{ language: "asc" }, { createdAt: "asc" }],
      include: {
        stories: {
          where: { status: "published", NOT: [{ text: null }, { title: null }] },
          orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
        },
      },
    });
  },
  ["studio-journeys-all-v2"],
  { revalidate: 300, tags: ["published-journey-stories"] }
);

// Topic slug → canonical display label (e.g. "food-everyday-life" →
// "Food & Everyday Life"). Slug-to-label reconstruction via string
// replacement can't recover characters like "&" / "and" / apostrophes
// that were stripped when the slug was created, so we pull the real
// labels from the Topic table.
const getTopicLabelBySlug = unstable_cache(
  async () => {
    const rows = await prisma.topic.findMany({ select: { slug: true, label: true } });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.slug && row.label) map[row.slug.toLowerCase()] = row.label;
    }
    return map;
  },
  ["topic-labels-by-slug-v1"],
  { revalidate: 3600, tags: ["topic-labels"] }
);

// Each Topic in Studio has a `defaultLevel` (a1, a2, b1, b2, c1, c2). The
// Journey record stores a flat list of topic slugs and level slugs, so to
// reconstruct the planned scaffold (which topic belongs to which level) we
// fall back on defaultLevel.
const getTopicDefaultLevelBySlug = unstable_cache(
  async () => {
    const rows = await prisma.topic.findMany({ select: { slug: true, defaultLevel: true } });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.slug && row.defaultLevel) map[row.slug.toLowerCase()] = row.defaultLevel.toLowerCase();
    }
    return map;
  },
  ["topic-default-level-by-slug-v1"],
  { revalidate: 3600, tags: ["topic-labels"] }
);

// Slugify para los track URL params: "Viajero LATAM" → "viajero-latam".
// Strip diacríticos, lowercase, separadores → "-".
function slugifyTrackLabel(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function buildJourneyVariantsFromStudio(
  language: string | undefined
): Promise<JourneyVariantTrack[]> {
  // `language` undefined o "*" = "No preference" del user. Trae
  // journeys de TODOS los idiomas disponibles para que el sheet
  // "Switch journey" liste todo. Con un language específico, filtra.
  const journeys =
    !language || language === "*"
      ? await getAllStudioJourneys()
      : await getStudioJourneysForLanguage(language);
  if (journeys.length === 0) return [];

  // Dedupe map para los slugs de tracks. Si dos journeys colisionan
  // en slug (mismo nombre normalizado), append "-2", "-3", etc.
  const slugCounts = new Map<string, number>();

  const topicLabelBySlug = await getTopicLabelBySlug();
  const topicDefaultLevelBySlug = await getTopicDefaultLevelBySlug();
  const resolveTopicLabel = (slug: string) =>
    topicLabelBySlug[slug.toLowerCase()] ?? prettifyTopicLabel(slug);

  // ONE TRACK PER STUDIO JOURNEY RECORD. We used to group journeys by
  // variant code (e.g. "italy") and merge their stories into a single
  // ladder — but that hid the fact that "Viajero" and "Conversacional"
  // are separate curated tracks. The mobile picker now exposes each
  // Journey record as its own option, labeled with `Journey.name`.
  const tracks: JourneyVariantTrack[] = [];
  for (const journey of journeys) {
    const levelMap = new Map<string, Map<string, JourneyStoryItem[]>>();

    // Seed topic slots per level using the order the user defined in
    // Studio (Journey.topics[] and Journey.levels[]). Each topic seats
    // itself at its `defaultLevel` so the scaffold reflects the
    // planned curriculum.
    const levelSlugs = (journey.levels ?? [])
      .map((level) => level.trim().toLowerCase())
      .filter(Boolean);
    const topicSlugsInOrder = (journey.topics ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const journeyLevelSet = new Set(levelSlugs);
    for (const levelId of levelSlugs) {
      if (!levelMap.has(levelId)) levelMap.set(levelId, new Map());
    }
    for (const topicSlug of topicSlugsInOrder) {
      const defaultLevel = topicDefaultLevelBySlug[topicSlug];
      if (!defaultLevel || !journeyLevelSet.has(defaultLevel)) continue;
      const topicMap = levelMap.get(defaultLevel)!;
      if (!topicMap.has(topicSlug)) topicMap.set(topicSlug, []);
    }

    for (const story of journey.stories) {
      if (!story.text || !story.title || !story.slug) continue;
      const levelId = story.level.trim().toLowerCase();
      const topicSlug = story.topic.trim().toLowerCase();
      if (!levelId || !topicSlug) continue;

      if (!levelMap.has(levelId)) levelMap.set(levelId, new Map());
      const topicMap = levelMap.get(levelId)!;
      if (!topicMap.has(topicSlug)) topicMap.set(topicSlug, []);

      const levelLabel = journeyLevelMeta[levelId as CefrLevel]?.title ?? levelId.toUpperCase();
      const storySlug = story.slug;
      const item: JourneyStoryItem = {
        id: `journey:${story.id}`,
        progressKey: `standalone:${storySlug}`,
        storySlug,
        sourcePath: `/stories/${storySlug}`,
        title: story.title,
        href: `/stories/${storySlug}`,
        coverUrl: story.coverUrl ?? undefined,
        language: journey.language,
        region: journey.variant,
        variant: journey.variant,
        journeyFocus: "General",
        levelLabel: CEFR_LEVEL_LABELS[levelId as CefrLevel] ?? levelLabel,
        topicLabel: resolveTopicLabel(topicSlug),
        text: story.text ?? undefined,
        vocabItems: Array.isArray(story.vocab) ? (story.vocab as unknown as VocabItem[]) : undefined,
      };
      topicMap.get(topicSlug)!.push(item);
    }

    const levels: JourneyLevel[] = [];
    // Emit levels in canonical CEFR order so the UI matches the
    // curriculum sequence. Empty topics and empty levels are kept so
    // the Studio plan (Journey.levels[] and Journey.topics[]) is fully
    // reflected on mobile, with placeholders for unpublished slots.
    for (const levelId of JOURNEY_LEVEL_IDS) {
      const topicMap = levelMap.get(levelId);
      if (!topicMap || topicMap.size === 0) continue;
      const meta = journeyLevelMeta[levelId];
      const topics: JourneyTopic[] = [];
      for (const [slug, stories] of topicMap) {
        topics.push({
          id: `${levelId}:${slug}`,
          slug,
          label: resolveTopicLabel(slug),
          storyCount: stories.length,
          stories,
        });
      }
      if (topics.length === 0) continue;
      // Final topic order = Journey.topics[] (the order set in Studio). The
      // topicMap insertion order above is unreliable: the seeding step only
      // seats a topic that has a story when its GLOBAL default level matches
      // this journey's level, so topics whose default level differs land in
      // story-arrival order instead of the Studio order. Re-sort by
      // Journey.topics so the home matches the journey-manager 1:1.
      topics.sort((a, b) => {
        const ai = topicSlugsInOrder.indexOf(a.slug);
        const bi = topicSlugsInOrder.indexOf(b.slug);
        return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
      });
      levels.push({
        id: meta.id,
        title: meta.title,
        subtitle: meta.subtitle,
        topics,
      });
    }

    if (levels.length === 0) continue;

    const trackLabel =
      (journey.name ?? "").trim() ||
      formatVariantLabel((journey.variant ?? "").trim().toLowerCase()) ||
      (journey.variant ?? "").trim().toUpperCase() ||
      "Journey";

    // Build slug: prefer trackLabel ("Viajero LATAM"), fallback al
    // variant ("latam") si el label no produce nada decente.
    const baseSlug =
      slugifyTrackLabel(trackLabel) ||
      slugifyTrackLabel((journey.variant ?? "").toString()) ||
      "journey";
    const nextCount = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, nextCount);
    const trackSlug = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`;

    tracks.push({
      id: journey.id,
      slug: trackSlug,
      label: trackLabel,
      language: (journey.language ?? "").trim() || null,
      variant: (journey.variant ?? "").trim().toLowerCase() || null,
      levels,
    });
  }

  // Sort by variant first, then by Journey.createdAt, so the order is
  // stable and groups regional variants together for the picker.
  tracks.sort((a, b) => a.label.localeCompare(b.label));

  return tracks;
}

export async function buildJourneyVariants(
  language?: string,
  _journeyFocus: JourneyFocus = "General"
): Promise<JourneyVariantTrack[]> {
  // Studio (Prisma Journey records) is the only source for the Journey tab.
  // Sanity stories are reader-only legacy content and must never appear here.
  // language=undefined activa el modo "No preference": el helper trae
  // journeys de TODOS los idiomas para que el sheet de switch list
  // todos los disponibles.
  return buildJourneyVariantsFromStudio(language);
}

export function buildJourneyTrackInsights(
  track: Pick<JourneyVariantTrack, "id" | "levels">,
  completedStoryKeys: Set<string>,
  practicedTopicKeys: Set<string>,
  passedCheckpointKeys: Set<string>,
  dueReviewItems: Array<{ progressKey: string | null }>
): JourneyTrackInsights {
  const dueReviewProgressKeySet = new Set(
    dueReviewItems.map((item) => item.progressKey).filter((value): value is string => Boolean(value))
  );

  let completedRequiredStories = 0;
  let totalRequiredStories = 0;
  let practicedTopicCount = 0;
  let totalTopicCount = 0;
  let passedCheckpointCount = 0;
  let dueReviewCount = 0;
  let currentLevelId: string | null = null;
  let currentLevelTitle: string | null = null;
  let nextMilestone = "Journey cleared";
  const reviewTopics: JourneyReviewLaneTopic[] = [];

  for (const level of track.levels) {
    let levelHasAnyStory = false;
    let levelHasAnyProgress = false;

    for (const topic of level.topics) {
      if (topic.storyCount <= 0) continue;

      levelHasAnyStory = true;
      totalTopicCount += 1;
      const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
      const completedStoryCount = getJourneyTopicCompletedStoryCount(topic, completedStoryKeys);
      const completedRequiredCount = Math.min(completedStoryCount, requiredStoryCount);
      const practiceKey = getJourneyTopicPracticeKey(track.id, level.id, topic.slug);
      const checkpointKey = getJourneyTopicCheckpointKey(track.id, level.id, topic.slug);
      const practiced = practicedTopicKeys.has(practiceKey);
      const checkpointPassed = passedCheckpointKeys.has(checkpointKey);
      const complete = requiredStoryCount > 0 && completedStoryCount >= requiredStoryCount;
      const topicDueCount = topic.stories.reduce((sum, story) => {
        return sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0);
      }, 0);

      totalRequiredStories += requiredStoryCount;
      completedRequiredStories += completedRequiredCount;
      if (practiced) practicedTopicCount += 1;
      if (checkpointPassed) passedCheckpointCount += 1;
      dueReviewCount += topicDueCount;

      if (completedRequiredCount > 0 || practiced || checkpointPassed || topicDueCount > 0) {
        levelHasAnyProgress = true;
      }

      if (topicDueCount > 0) {
        reviewTopics.push({
          levelId: level.id,
          levelTitle: level.title,
          topicSlug: topic.slug,
          topicLabel: topic.label,
          dueCount: topicDueCount,
          complete,
          practiced,
          checkpointPassed,
        });
      }

      if (nextMilestone === "Journey cleared") {
        if (!complete) {
          const remaining = Math.max(requiredStoryCount - completedStoryCount, 0);
          nextMilestone = `Complete ${remaining} more ${remaining === 1 ? "story" : "stories"} in ${topic.label}`;
        } else if (!practiced) {
          nextMilestone = `Practice ${topic.label}`;
        } else if (!checkpointPassed) {
          nextMilestone = `Clear the ${topic.label} checkpoint`;
        }
      }
    }

    if (!currentLevelId && levelHasAnyStory && levelHasAnyProgress) {
      currentLevelId = level.id;
      currentLevelTitle = level.title;
    }
  }

  if (!currentLevelId) {
    const firstLevelWithStories = track.levels.find((level) => level.topics.some((topic) => topic.storyCount > 0));
    currentLevelId = firstLevelWithStories?.id ?? null;
    currentLevelTitle = firstLevelWithStories?.title ?? null;
  }

  reviewTopics.sort((a, b) => b.dueCount - a.dueCount || a.topicLabel.localeCompare(b.topicLabel));

  const totalCheckpointCount = totalTopicCount;
  const totalSteps = totalRequiredStories + totalTopicCount + totalCheckpointCount;
  const completedSteps = completedRequiredStories + practicedTopicCount + passedCheckpointCount;

  return {
    score: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    completedSteps,
    totalSteps,
    completedRequiredStories,
    totalRequiredStories,
    practicedTopicCount,
    totalTopicCount,
    passedCheckpointCount,
    totalCheckpointCount,
    dueReviewCount,
    dueTopicCount: reviewTopics.length,
    reviewTopics,
    currentLevelId,
    currentLevelTitle,
    nextMilestone,
  };
}

export async function buildJourneyLevels(
  variantIdOrSlug?: string,
  language = DEFAULT_LANGUAGE,
  journeyFocus: JourneyFocus = "General",
  levelHint?: string
): Promise<JourneyLevel[]> {
  const tracks = await buildJourneyVariants(language, journeyFocus);
  if (tracks.length === 0) return [];

  // Resuelve por slug, id, o variant code. El URL ahora usa slug
  // ("viajero-latam") pero hay enlaces viejos con cuid o con el
  // variant raw ("latam"); aceptamos los 3 para no romper bookmarks.
  if (variantIdOrSlug) {
    const lookup = variantIdOrSlug.toLowerCase();
    // Un `variant` ya NO es único: un mismo region/variant puede tener
    // varios journeys, cada uno con su propio set de niveles (p.ej.
    // LATAM A1 y LATAM A2 son journeys separados, ambos variant="latam").
    // Cuando el lookup es por variant y hay varios tracks, desempatamos
    // por el nivel pedido para no caer en el journey equivocado.
    const wantedLevel = levelHint?.trim().toLowerCase();
    const byVariant = tracks.filter((track) => track.variant === lookup);
    const variantMatch =
      (wantedLevel
        ? byVariant.find((track) => track.levels.some((level) => level.id === wantedLevel))
        : undefined) ?? byVariant[0];
    const matched =
      tracks.find((track) => track.slug === lookup) ??
      tracks.find((track) => track.id === variantIdOrSlug) ??
      variantMatch;
    return matched?.levels ?? [];
  }

  return tracks[0]?.levels ?? [];
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function normalizeText(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSentenceForWord(text: string, word: string): string | undefined {
  const sentences = splitSentences(text);
  const wordPattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return sentences.find((sentence) => wordPattern.test(sentence));
}

type TopicVocabItem = VocabItem & {
  sourceKey: string;
  sentence?: string;
};

function collectTopicVocab(stories: JourneyStoryItem[]): TopicVocabItem[] {
  const items: TopicVocabItem[] = [];

  for (const story of stories) {
    for (const vocab of story.vocabItems ?? []) {
      const word = normalizeText(vocab.word);
      const definition = normalizeText(vocab.definition);
      if (!word || !definition) continue;
      items.push({
        ...vocab,
        word,
        definition,
        sourceKey: story.progressKey,
        sentence: findSentenceForWord(story.text ?? "", word),
      });
    }
  }

  return items;
}

function buildSentenceStem(sentence: string, word: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  if (!pattern.test(sentence)) return null;
  return sentence.replace(pattern, "_____");
}

function isExpressionLike(item: TopicVocabItem): boolean {
  const type = normalizeText(item.type).toLowerCase();
  return /expression|phrase|idiom|connector|chunk/.test(type) || item.word.includes(" ");
}

function uniqueValues(values: string[]): string[] {
  return values.filter((value, index, array) => array.indexOf(value) === index);
}

function buildMeaningQuestion(
  item: TopicVocabItem,
  uniqueItems: TopicVocabItem[],
  questionId: string
): JourneyCheckpointQuestion | null {
  const distractors = shuffle(
    uniqueValues(
      uniqueItems
        .filter((candidate) => candidate.word.toLowerCase() !== item.word.toLowerCase())
        .map((candidate) => candidate.definition)
    )
  ).slice(0, 3);

  if (distractors.length < 3) return null;

  return {
    id: questionId,
    kind: "meaning",
    word: item.word,
    prompt: `Choose the best meaning for "${item.word}".`,
    options: shuffle([item.definition, ...distractors]),
    answer: item.definition,
  };
}

function buildWordChoiceQuestion(
  kind: "context" | "listening" | "natural_usage",
  item: TopicVocabItem,
  uniqueItems: TopicVocabItem[],
  questionId: string
): JourneyCheckpointQuestion | null {
  const distractors = shuffle(
    uniqueValues(
      uniqueItems
        .filter((candidate) => candidate.word.toLowerCase() !== item.word.toLowerCase())
        .map((candidate) => candidate.word)
    )
  ).slice(0, 3);

  if (distractors.length < 3) return null;

  const stem =
    kind === "listening"
      ? undefined
      : item.sentence
        ? buildSentenceStem(item.sentence, item.word) ?? item.sentence
        : undefined;

  const prompt =
    kind === "context"
      ? "Choose the word that best completes the sentence."
      : kind === "natural_usage"
        ? "Choose the expression that sounds most natural here."
        : 'Listen and choose the word you hear.';

  return {
    id: questionId,
    kind,
    word: item.word,
    prompt,
    stem,
    options: shuffle([item.word, ...distractors]),
    answer: item.word,
    ttsText: kind === "listening" ? item.word : undefined,
  };
}

export async function buildJourneyTopicPracticeItems(
  variantId: string | undefined,
  levelId: string,
  topicSlug: string,
  journeyFocus: JourneyFocus = "General"
): Promise<{
  topic: JourneyTopic;
  level: JourneyLevel;
  items: PracticeFavoriteItem[];
} | null> {
  const levels = await buildJourneyLevels(variantId, DEFAULT_LANGUAGE, journeyFocus, levelId);
  const level = levels.find((entry) => entry.id === levelId) ?? null;
  const topic = level?.topics.find((entry) => entry.slug === topicSlug) ?? null;

  if (!level || !topic) return null;

  const items: PracticeFavoriteItem[] = [];

  for (const story of topic.stories) {
    for (const vocab of story.vocabItems ?? []) {
      const word = normalizeText(vocab.word);
      const translation = normalizeText(vocab.definition);
      if (!word || !translation) continue;

      const sentence =
        findSentenceForWord(story.text ?? "", word) ??
        normalizeText(vocab.note) ??
        null;

      items.push({
        word,
        translation,
        wordType: normalizeText(vocab.type) || null,
        exampleSentence: sentence,
        storySlug: normalizeText(story.storySlug) || null,
        storyTitle: normalizeText(story.title) || null,
        sourcePath: story.sourcePath,
        language: normalizeText(story.language) || null,
        practiceSource: "curriculum",
      });
    }
  }

  return {
    topic,
    level,
    items,
  };
}

export async function buildJourneyTopicCheckpoint(
  variantId: string | undefined,
  levelId: string,
  topicSlug: string
): Promise<{
  topic: JourneyTopic;
  level: JourneyLevel;
  checkpointKey: string;
  questions: JourneyCheckpointQuestion[];
} | null> {
  const levels = await buildJourneyLevels(variantId, DEFAULT_LANGUAGE, "General", levelId);
  const level = levels.find((entry) => entry.id === levelId);
  const topic = level?.topics.find((entry) => entry.slug === topicSlug);

  if (!level || !topic) return null;

  const vocabPool = collectTopicVocab(topic.stories);
  const uniqueByWord = new Map<string, TopicVocabItem>();
  for (const item of vocabPool) {
    const key = item.word.toLowerCase();
    if (!uniqueByWord.has(key)) uniqueByWord.set(key, item);
  }

  const uniqueItems = shuffle(Array.from(uniqueByWord.values()));
  const questionPlan: Array<JourneyCheckpointQuestion["kind"]> = [
    "meaning",
    "context",
    "listening",
    "meaning",
    "context",
    "listening",
    "natural_usage",
    "meaning",
  ];

  const pools: Record<JourneyCheckpointQuestion["kind"], TopicVocabItem[]> = {
    meaning: shuffle(uniqueItems),
    context: shuffle(uniqueItems.filter((item) => item.sentence)),
    listening: shuffle(uniqueItems),
    natural_usage: shuffle(uniqueItems.filter((item) => item.sentence && isExpressionLike(item))),
  };

  if (pools.natural_usage.length === 0) {
    pools.natural_usage = shuffle(uniqueItems.filter((item) => item.sentence));
  }

  const usedWords = new Set<string>();
  const questions: JourneyCheckpointQuestion[] = [];

  for (const kind of questionPlan) {
    const pool = pools[kind];
    const nextItem = pool.find((candidate) => !usedWords.has(candidate.word.toLowerCase()));
    if (!nextItem) continue;

    const questionId = `${topic.id}:${kind}:${questions.length + 1}`;
    const question =
      kind === "meaning"
        ? buildMeaningQuestion(nextItem, uniqueItems, questionId)
        : buildWordChoiceQuestion(kind, nextItem, uniqueItems, questionId);

    if (!question) continue;

    usedWords.add(nextItem.word.toLowerCase());
    questions.push(question);
  }

  if (questions.length < 5) return null;

  return {
    topic,
    level,
    checkpointKey: getJourneyTopicCheckpointKey(variantId, levelId, topicSlug),
    questions,
  };
}
