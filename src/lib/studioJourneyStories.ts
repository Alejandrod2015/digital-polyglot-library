// /src/lib/studioJourneyStories.ts
//
// Studio Next.js editor surface for journey-eligible standalone stories.
// Originally backed by Sanity `standaloneStory`; now reads and writes
// directly against Prisma `StandaloneStory` after the Sanity -> Studio
// cutover. The public API (types and functions) is preserved so the
// existing UI components, API routes, and agent tools keep working.
//
// "draft" semantics from Sanity Studio do not map cleanly to Prisma; we
// expose `hasDraft = false` and `hasPublished = true` for every row.

import { prisma } from "@/lib/prisma";
import type { Prisma, StandaloneStory } from "@/generated/prisma";
import { JOURNEY_FOCUS_OPTIONS, type JourneyFocus } from "@/lib/onboarding";
import { getJourneyCurriculumPlans } from "@/lib/journeyCurriculumSource";

export type StudioJourneyStory = {
  id: string;
  documentId: string;
  draftId: string;
  hasDraft: boolean;
  hasPublished: boolean;
  title: string;
  slug: string;
  synopsis: string;
  text: string;
  vocabRaw: string;
  coverUrl: string;
  audioUrl: string;
  language: string;
  variant: string;
  region: string;
  cefrLevel: string;
  topic: string;
  languageFocus: string;
  journeyTopic: string;
  journeyOrder: number | null;
  journeyFocus: string;
  journeyEligible: boolean;
  published: boolean;
  storyVocabQualityRaw: string;
  vocabValidationRaw: string;
  audioQaStatus: string;
  audioQaScore: number | null;
  audioQaNotes: string;
  audioQaTranscript: string;
  audioQaCheckedAt: string;
  audioDeliveryQaStatus: string;
  audioDeliveryQaScore: number | null;
  audioDeliveryQaNotes: string;
  audioDeliveryQaCheckedAt: string;
  updatedAt: string;
};

export type JourneyStoryPatch = {
  title?: string;
  slug?: string;
  synopsis?: string;
  text?: string;
  vocabRaw?: string;
  coverUrl?: string;
  audioUrl?: string;
  language?: string;
  variant?: string;
  region?: string;
  cefrLevel?: string;
  topic?: string;
  languageFocus?: string;
  journeyTopic?: string;
  journeyOrder?: number | null;
  journeyFocus?: string;
  journeyEligible?: boolean;
  published?: boolean;
  storyVocabQualityRaw?: string;
  vocabValidationRaw?: string;
  audioQaStatus?: string;
  audioQaScore?: number | null;
  audioDeliveryQaStatus?: string;
};

export type JourneyCoverageGap = {
  key: string;
  type: "core-gap" | "focus-opportunity";
  language: string;
  variant: string;
  level: string;
  topic: string;
  topicSlug: string;
  slotOrder: number;
  focus: JourneyFocus;
  label: string;
  existingStories: number;
};

function toStudioStory(row: StandaloneStory): StudioJourneyStory {
  return {
    id: row.id,
    documentId: row.id,
    draftId: `drafts.${row.id}`,
    hasDraft: false,
    hasPublished: true,
    title: row.title ?? "",
    slug: row.slug ?? "",
    synopsis: row.synopsis ?? "",
    text: row.text ?? "",
    vocabRaw: row.vocabRaw ?? "",
    coverUrl: row.coverUrl ?? row.cover ?? "",
    audioUrl: row.audioUrl ?? row.audio ?? "",
    language: row.language ?? "spanish",
    variant: row.variant ?? "latam",
    region: row.region ?? "",
    cefrLevel: row.cefrLevel ?? "a1",
    topic: row.topic ?? "",
    languageFocus: row.focus ?? "mixed",
    journeyTopic: row.journeyTopic ?? "",
    journeyOrder:
      typeof row.journeyOrder === "number" && Number.isFinite(row.journeyOrder)
        ? row.journeyOrder
        : null,
    journeyFocus: row.journeyFocus ?? "General",
    journeyEligible: Boolean(row.journeyEligible),
    published: Boolean(row.published),
    storyVocabQualityRaw: row.storyVocabQualityRaw ?? "",
    vocabValidationRaw: row.vocabValidationRaw ?? "",
    audioQaStatus: row.audioQaStatus ?? "",
    audioQaScore:
      typeof row.audioQaScore === "number" && Number.isFinite(row.audioQaScore)
        ? row.audioQaScore
        : null,
    audioQaNotes: row.audioQaNotes ?? "",
    audioQaTranscript: row.audioQaTranscript ?? "",
    audioQaCheckedAt: row.audioQaCheckedAt?.toISOString() ?? "",
    audioDeliveryQaStatus: row.audioDeliveryQaStatus ?? "",
    audioDeliveryQaScore:
      typeof row.audioDeliveryQaScore === "number" && Number.isFinite(row.audioDeliveryQaScore)
        ? row.audioDeliveryQaScore
        : null,
    audioDeliveryQaNotes: row.audioDeliveryQaNotes ?? "",
    audioDeliveryQaCheckedAt: row.audioDeliveryQaCheckedAt?.toISOString() ?? "",
    updatedAt: row.updatedAt.toISOString(),
  };
}

function journeyWhere(): Prisma.StandaloneStoryWhereInput {
  return {
    OR: [
      { journeyEligible: true },
      { journeyTopic: { not: null } },
      { journeyOrder: { not: null } },
      { journeyFocus: { not: null } },
    ],
  };
}

export async function listStudioJourneyStories(): Promise<StudioJourneyStory[]> {
  const rows = await prisma.standaloneStory.findMany({
    where: journeyWhere(),
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows
    .map(toStudioStory)
    .sort((a, b) => {
      const orderA = a.journeyOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.journeyOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
}

export async function listStudioJourneyStoriesForVariant(
  language: string,
  variant: string
): Promise<StudioJourneyStory[]> {
  const stories = await listStudioJourneyStories();
  const normalizedLanguage = language.trim().toLowerCase();
  const normalizedVariant = variant.trim().toLowerCase();
  return stories.filter(
    (story) =>
      story.language.trim().toLowerCase() === normalizedLanguage &&
      story.variant.trim().toLowerCase() === normalizedVariant
  );
}

export async function getStudioJourneyStory(id: string): Promise<StudioJourneyStory | null> {
  const row = await prisma.standaloneStory.findUnique({ where: { id } });
  return row ? toStudioStory(row) : null;
}

function patchToData(patch: JourneyStoryPatch): Prisma.StandaloneStoryUpdateInput {
  const data: Prisma.StandaloneStoryUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.slug !== undefined) data.slug = patch.slug;
  if (patch.synopsis !== undefined) data.synopsis = patch.synopsis;
  if (patch.text !== undefined) data.text = patch.text;
  if (patch.vocabRaw !== undefined) data.vocabRaw = patch.vocabRaw;
  if (patch.coverUrl !== undefined) data.coverUrl = patch.coverUrl;
  if (patch.audioUrl !== undefined) data.audioUrl = patch.audioUrl;
  if (patch.language !== undefined) data.language = patch.language;
  if (patch.variant !== undefined) data.variant = patch.variant;
  if (patch.region !== undefined) data.region = patch.region;
  if (patch.cefrLevel !== undefined) data.cefrLevel = patch.cefrLevel;
  if (patch.topic !== undefined) data.topic = patch.topic;
  if (patch.languageFocus !== undefined) data.focus = patch.languageFocus;
  if (patch.journeyTopic !== undefined) data.journeyTopic = patch.journeyTopic;
  if (patch.journeyOrder !== undefined) data.journeyOrder = patch.journeyOrder;
  if (patch.journeyFocus !== undefined) data.journeyFocus = patch.journeyFocus;
  if (patch.journeyEligible !== undefined) data.journeyEligible = patch.journeyEligible;
  if (patch.published !== undefined) data.published = patch.published;
  if (patch.storyVocabQualityRaw !== undefined) data.storyVocabQualityRaw = patch.storyVocabQualityRaw;
  if (patch.vocabValidationRaw !== undefined) data.vocabValidationRaw = patch.vocabValidationRaw;
  if (patch.audioQaStatus !== undefined) data.audioQaStatus = patch.audioQaStatus;
  if (patch.audioQaScore !== undefined) data.audioQaScore = patch.audioQaScore;
  if (patch.audioDeliveryQaStatus !== undefined) data.audioDeliveryQaStatus = patch.audioDeliveryQaStatus;
  return data;
}

export async function createStudioJourneyStory(): Promise<StudioJourneyStory> {
  return createStudioJourneyStoryWithSeed();
}

function newJourneyStoryId(): string {
  // Use a slug-safe random id so it can be addressed by /studio routes
  // without escape gymnastics.
  return `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createStudioJourneyStoryWithSeed(
  seed: JourneyStoryPatch = {}
): Promise<StudioJourneyStory> {
  const id = newJourneyStoryId();
  const created = await prisma.standaloneStory.create({
    data: {
      id,
      slug: seed.slug ?? id,
      sourceType: "studio",
      language: seed.language ?? "spanish",
      variant: seed.variant ?? "latam",
      region: seed.region ?? "colombia",
      cefrLevel: seed.cefrLevel ?? "a1",
      focus: seed.languageFocus ?? "mixed",
      topic: seed.topic ?? "",
      journeyEligible: seed.journeyEligible ?? true,
      journeyTopic: seed.journeyTopic ?? "",
      journeyOrder: seed.journeyOrder ?? null,
      journeyFocus: seed.journeyFocus ?? "General",
      published: seed.published ?? false,
      title: seed.title ?? "Untitled Journey Story",
      synopsis: seed.synopsis ?? "",
      text: seed.text ?? "",
      vocabRaw: seed.vocabRaw ?? "",
      coverUrl: seed.coverUrl ?? null,
      audioUrl: seed.audioUrl ?? null,
    },
  });
  return toStudioStory(created);
}

export async function patchStudioJourneyStory(
  id: string,
  patch: JourneyStoryPatch
): Promise<StudioJourneyStory> {
  try {
    const updated = await prisma.standaloneStory.update({
      where: { id },
      data: patchToData(patch),
    });
    return toStudioStory(updated);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      throw new Error("Story not found");
    }
    throw err;
  }
}

export async function duplicateStudioJourneyStory(id: string): Promise<StudioJourneyStory> {
  const current = await getStudioJourneyStory(id);
  if (!current) throw new Error("Story not found");

  return createStudioJourneyStoryWithSeed({
    title: current.title ? `${current.title} Copy` : "Untitled Journey Story Copy",
    slug: current.slug ? `${current.slug}-copy` : "",
    synopsis: current.synopsis,
    text: current.text,
    vocabRaw: current.vocabRaw,
    coverUrl: current.coverUrl,
    audioUrl: current.audioUrl,
    language: current.language,
    variant: current.variant,
    region: current.region,
    cefrLevel: current.cefrLevel,
    topic: current.topic,
    languageFocus: current.languageFocus,
    journeyTopic: current.journeyTopic,
    journeyOrder: current.journeyOrder,
    journeyFocus: current.journeyFocus as JourneyFocus,
    journeyEligible: current.journeyEligible,
    published: false,
  });
}

export async function deleteStudioJourneyStory(id: string): Promise<void> {
  try {
    await prisma.standaloneStory.delete({ where: { id } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") return;
    throw err;
  }
}

export async function getJourneyCoverageGaps(
  storiesInput?: StudioJourneyStory[]
): Promise<JourneyCoverageGap[]> {
  const stories = storiesInput ?? (await listStudioJourneyStories());
  const curriculumPlans = await getJourneyCurriculumPlans();
  const gaps: JourneyCoverageGap[] = [];

  for (const variantPlan of curriculumPlans) {
    for (const level of variantPlan.levels) {
      for (const topic of level.topics) {
        const slotTarget = Math.max(1, topic.storyTarget || 1);
        for (let order = 1; order <= slotTarget; order += 1) {
          const candidates = stories.filter((story) => {
            const storyLanguage = story.language.trim().toLowerCase();
            const storyVariant = story.variant.trim().toLowerCase();
            const storyLevel = story.cefrLevel.trim().toLowerCase();
            const storyTopic = story.journeyTopic.trim().toLowerCase();
            return (
              (story.journeyOrder ?? 1) === order &&
              storyTopic === topic.slug &&
              storyLevel === level.id &&
              storyVariant === variantPlan.variantId.toLowerCase() &&
              storyLanguage === variantPlan.language.toLowerCase()
            );
          });

          const generalExists = candidates.some(
            (story) => (story.journeyFocus || "General") === "General"
          );

          if (!generalExists) {
            gaps.push({
              key: `${variantPlan.variantId}:${level.id}:${topic.slug}:${order}:General`,
              type: "core-gap",
              language: variantPlan.language,
              variant: variantPlan.variantId,
              level: level.id,
              topic: topic.label,
              topicSlug: topic.slug,
              slotOrder: order,
              focus: "General",
              label: "Missing general story",
              existingStories: candidates.length,
            });
            continue;
          }

          for (const focus of JOURNEY_FOCUS_OPTIONS.filter(
            (entry): entry is Exclude<JourneyFocus, "General"> => entry !== "General"
          )) {
            const focusExists = candidates.some((story) => story.journeyFocus === focus);
            if (!focusExists) {
              gaps.push({
                key: `${variantPlan.variantId}:${level.id}:${topic.slug}:${order}:${focus}`,
                type: "focus-opportunity",
                language: variantPlan.language,
                variant: variantPlan.variantId,
                level: level.id,
                topic: topic.label,
                topicSlug: topic.slug,
                slotOrder: order,
                focus,
                label: `Missing ${focus} alternative`,
                existingStories: candidates.length,
              });
            }
          }
        }
      }
    }
  }

  return gaps.sort((a, b) => {
    if (a.type !== b.type) return a.type === "core-gap" ? -1 : 1;
    const variantA = `${a.language}::${a.variant}`.toLowerCase();
    const variantB = `${b.language}::${b.variant}`.toLowerCase();
    if (variantA !== variantB) return variantA.localeCompare(variantB);
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    if (a.topicSlug !== b.topicSlug) return a.topicSlug.localeCompare(b.topicSlug);
    if (a.slotOrder !== b.slotOrder) return a.slotOrder - b.slotOrder;
    return a.focus.localeCompare(b.focus);
  });
}
