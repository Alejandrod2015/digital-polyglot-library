import { randomUUID } from "crypto";
import { rawServerClient, writeClient } from "@/sanity/lib/client";
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
  audioDeliveryQaStatus: string;
  updatedAt: string;
};

type SanityJourneyStoryDoc = {
  _id: string;
  _updatedAt?: string;
  title?: string;
  slug?: { current?: string };
  synopsis?: string;
  text?: string;
  vocabRaw?: string;
  coverUrl?: string;
  audioUrl?: string;
  language?: string;
  variant?: string;
  region_es?: string;
  region_en?: string;
  region_de?: string;
  region_fr?: string;
  region_it?: string;
  region_pt?: string;
  cefrLevel?: string;
  topic?: string;
  focus?: string;
  journeyTopic?: string;
  journeyOrder?: number;
  journeyFocus?: string;
  journeyEligible?: boolean;
  published?: boolean;
  storyVocabQualityRaw?: string;
  vocabValidationRaw?: string;
  audioQaStatus?: string;
  audioQaScore?: number;
  audioDeliveryQaStatus?: string;
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

function baseId(id: string): string {
  return id.replace(/^drafts\./, "");
}

function regionFromDoc(doc: SanityJourneyStoryDoc): string {
  return (
    doc.region_es ??
    doc.region_en ??
    doc.region_de ??
    doc.region_fr ??
    doc.region_it ??
    doc.region_pt ??
    ""
  );
}

function toStudioStory(
  id: string,
  draftDoc: SanityJourneyStoryDoc | undefined,
  publishedDoc: SanityJourneyStoryDoc | undefined
): StudioJourneyStory {
  const active = draftDoc ?? publishedDoc;
  return {
    id,
    documentId: id,
    draftId: `drafts.${id}`,
    hasDraft: Boolean(draftDoc),
    hasPublished: Boolean(publishedDoc),
    title: active?.title ?? "",
    slug: active?.slug?.current ?? "",
    synopsis: active?.synopsis ?? "",
    text: active?.text ?? "",
    vocabRaw: active?.vocabRaw ?? "",
    coverUrl: active?.coverUrl ?? "",
    audioUrl: active?.audioUrl ?? "",
    language: active?.language ?? "spanish",
    variant: active?.variant ?? "latam",
    region: active ? regionFromDoc(active) : "",
    cefrLevel: active?.cefrLevel ?? "a1",
    topic: active?.topic ?? "",
    languageFocus: active?.focus ?? "mixed",
    journeyTopic: active?.journeyTopic ?? "",
    journeyOrder:
      typeof active?.journeyOrder === "number" && Number.isFinite(active.journeyOrder)
        ? active.journeyOrder
        : null,
    journeyFocus: active?.journeyFocus ?? "General",
    journeyEligible: Boolean(active?.journeyEligible ?? true),
    published: Boolean(active?.published ?? false),
    storyVocabQualityRaw: active?.storyVocabQualityRaw ?? "",
    vocabValidationRaw: active?.vocabValidationRaw ?? "",
    audioQaStatus: active?.audioQaStatus ?? "",
    audioQaScore:
      typeof active?.audioQaScore === "number" && Number.isFinite(active.audioQaScore)
        ? active.audioQaScore
        : null,
    audioDeliveryQaStatus: active?.audioDeliveryQaStatus ?? "",
    updatedAt: active?._updatedAt ?? "",
  };
}

function regionFieldForLanguage(language: string): string {
  switch (language) {
    case "english":
      return "region_en";
    case "german":
      return "region_de";
    case "french":
      return "region_fr";
    case "italian":
      return "region_it";
    case "portuguese":
      return "region_pt";
    case "spanish":
    default:
      return "region_es";
  }
}

export async function listStudioJourneyStories(): Promise<StudioJourneyStory[]> {
  const docs = await rawServerClient.fetch<SanityJourneyStoryDoc[]>(`
    *[
      _type == "standaloneStory" &&
      (
        journeyEligible == true ||
        defined(journeyTopic) ||
        defined(journeyOrder) ||
        defined(journeyFocus)
      )
    ] | order(_updatedAt desc) {
      _id,
      _updatedAt,
      title,
      slug,
      synopsis,
      text,
      vocabRaw,
      coverUrl,
      audioUrl,
      language,
      variant,
      region_es,
      region_en,
      region_de,
      region_fr,
      region_it,
      region_pt,
      cefrLevel,
      topic,
      focus,
      journeyTopic,
      journeyOrder,
      journeyFocus,
      journeyEligible,
      published,
      storyVocabQualityRaw,
      vocabValidationRaw,
      audioQaStatus,
      audioQaScore,
      audioDeliveryQaStatus
    }
  `);

  const merged = new Map<
    string,
    { draftDoc?: SanityJourneyStoryDoc; publishedDoc?: SanityJourneyStoryDoc }
  >();

  for (const doc of docs) {
    const id = baseId(doc._id);
    const current = merged.get(id) ?? {};
    if (doc._id.startsWith("drafts.")) current.draftDoc = doc;
    else current.publishedDoc = doc;
    merged.set(id, current);
  }

  return Array.from(merged.entries())
    .map(([id, row]) => toStudioStory(id, row.draftDoc, row.publishedDoc))
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
  const docs = await rawServerClient.fetch<SanityJourneyStoryDoc[]>(
    `
    *[
      _type == "standaloneStory" &&
      (_id == $publishedId || _id == $draftId)
    ] {
      _id,
      _updatedAt,
      title,
      slug,
      synopsis,
      text,
      vocabRaw,
      coverUrl,
      audioUrl,
      language,
      variant,
      region_es,
      region_en,
      region_de,
      region_fr,
      region_it,
      region_pt,
      cefrLevel,
      topic,
      focus,
      journeyTopic,
      journeyOrder,
      journeyFocus,
      journeyEligible,
      published,
      storyVocabQualityRaw,
      vocabValidationRaw,
      audioQaStatus,
      audioQaScore,
      audioDeliveryQaStatus
    }
  `,
    { publishedId: id, draftId: `drafts.${id}` }
  );

  if (!docs.length) return null;
  const draftDoc = docs.find((doc) => doc._id.startsWith("drafts."));
  const publishedDoc = docs.find((doc) => !doc._id.startsWith("drafts."));
  return toStudioStory(id, draftDoc, publishedDoc);
}

export async function createStudioJourneyStory(): Promise<StudioJourneyStory> {
  return createStudioJourneyStoryWithSeed();
}

export async function createStudioJourneyStoryWithSeed(
  seed: JourneyStoryPatch = {}
): Promise<StudioJourneyStory> {
  const publishedId = randomUUID();
  const draftId = `drafts.${publishedId}`;
  const language = seed.language ?? "spanish";
  const regionField = regionFieldForLanguage(language);
  const created = await writeClient.createIfNotExists({
    _id: draftId,
    _type: "standaloneStory",
    sourceType: "sanity",
    language,
    variant: seed.variant ?? "latam",
    [regionField]: seed.region ?? "colombia",
    cefrLevel: seed.cefrLevel ?? "a1",
    focus: seed.languageFocus ?? "mixed",
    topic: seed.topic ?? "",
    journeyEligible: seed.journeyEligible ?? true,
    journeyTopic: seed.journeyTopic ?? "",
    journeyOrder: seed.journeyOrder ?? undefined,
    journeyFocus: seed.journeyFocus ?? "General",
    published: seed.published ?? false,
    title: seed.title ?? "Untitled Journey Story",
    synopsis: seed.synopsis ?? "",
    text: seed.text ?? "",
    vocabRaw: seed.vocabRaw ?? "",
    coverUrl: seed.coverUrl ?? "",
    audioUrl: seed.audioUrl ?? "",
    slug: seed.slug ? { _type: "slug", current: seed.slug } : undefined,
  });

  return toStudioStory(publishedId, created as SanityJourneyStoryDoc, undefined);
}

export async function patchStudioJourneyStory(
  id: string,
  patch: JourneyStoryPatch
): Promise<StudioJourneyStory> {
  const current = await getStudioJourneyStory(id);
  if (!current) {
    throw new Error("Story not found");
  }

  const draftId = `drafts.${id}`;
  const regionField = regionFieldForLanguage(patch.language ?? current.language);

  let tx = writeClient.transaction();

  tx = tx.createIfNotExists({
    _id: draftId,
    _type: "standaloneStory",
    title: current.title || "Untitled Journey Story",
    language: current.language,
    variant: current.variant,
    [regionFieldForLanguage(current.language)]: current.region || "",
    cefrLevel: current.cefrLevel,
    focus: current.languageFocus,
    topic: current.topic,
    journeyEligible: current.journeyEligible,
    journeyTopic: current.journeyTopic,
    journeyOrder: current.journeyOrder ?? undefined,
    journeyFocus: current.journeyFocus,
    published: current.published,
    synopsis: current.synopsis,
    text: current.text,
    vocabRaw: current.vocabRaw,
    coverUrl: current.coverUrl,
    audioUrl: current.audioUrl,
    slug: current.slug ? { _type: "slug", current: current.slug } : undefined,
  });

  const setPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) setPatch.title = patch.title;
  if (patch.slug !== undefined) setPatch.slug = { _type: "slug", current: patch.slug };
  if (patch.synopsis !== undefined) setPatch.synopsis = patch.synopsis;
  if (patch.text !== undefined) setPatch.text = patch.text;
  if (patch.vocabRaw !== undefined) setPatch.vocabRaw = patch.vocabRaw;
  if (patch.coverUrl !== undefined) setPatch.coverUrl = patch.coverUrl;
  if (patch.audioUrl !== undefined) setPatch.audioUrl = patch.audioUrl;
  if (patch.language !== undefined) setPatch.language = patch.language;
  if (patch.variant !== undefined) setPatch.variant = patch.variant;
  if (patch.cefrLevel !== undefined) setPatch.cefrLevel = patch.cefrLevel;
  if (patch.topic !== undefined) setPatch.topic = patch.topic;
  if (patch.languageFocus !== undefined) setPatch.focus = patch.languageFocus;
  if (patch.journeyTopic !== undefined) setPatch.journeyTopic = patch.journeyTopic;
  if (patch.journeyOrder !== undefined) setPatch.journeyOrder = patch.journeyOrder;
  if (patch.journeyFocus !== undefined) setPatch.journeyFocus = patch.journeyFocus;
  if (patch.journeyEligible !== undefined) setPatch.journeyEligible = patch.journeyEligible;
  if (patch.published !== undefined) setPatch.published = patch.published;
  if (patch.region !== undefined) {
    setPatch.region_es = undefined;
    setPatch.region_en = undefined;
    setPatch.region_de = undefined;
    setPatch.region_fr = undefined;
    setPatch.region_it = undefined;
    setPatch.region_pt = undefined;
    setPatch[regionField] = patch.region;
  }

  const unsetFields: string[] = [];
  if (patch.region !== undefined) {
    for (const field of ["region_es", "region_en", "region_de", "region_fr", "region_it", "region_pt"]) {
      if (field !== regionField) unsetFields.push(field);
    }
  }

  tx = tx.patch(draftId, (builder) => {
    let next = builder.set(setPatch);
    if (unsetFields.length) next = next.unset(unsetFields);
    return next;
  });

  await tx.commit();
  const updated = await getStudioJourneyStory(id);
  if (!updated) throw new Error("Story not found after save");
  return updated;
}

export async function duplicateStudioJourneyStory(id: string): Promise<StudioJourneyStory> {
  const current = await getStudioJourneyStory(id);
  if (!current) {
    throw new Error("Story not found");
  }

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
  const draftId = `drafts.${id}`;
  await Promise.allSettled([
    writeClient.delete(draftId),
    writeClient.delete(id),
  ]);
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
            const sameSlot =
              (story.journeyOrder ?? 1) === order &&
              storyTopic === topic.slug &&
              storyLevel === level.id &&
              storyVariant === variantPlan.variantId.toLowerCase() &&
              storyLanguage === variantPlan.language.toLowerCase();
            return sameSlot;
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
