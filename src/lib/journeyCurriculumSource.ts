import { unstable_cache } from "next/cache";
import { rawServerClient, freshClient, writeClient } from "@/sanity/lib/client";
import {
  JOURNEY_CURRICULUM as FALLBACK_CURRICULUM,
  type JourneyLevelPlan,
  type JourneyVariantPlan,
} from "@/app/journey/journeyCurriculum";

type SanityJourneyTopicPlan = {
  slug?: string;
  label?: string;
  storyTarget?: number;
};

type SanityJourneyLevelPlan = {
  id?: string;
  title?: string;
  subtitle?: string;
  topicTarget?: number;
  storyTargetPerTopic?: number;
  topics?: SanityJourneyTopicPlan[];
};

type SanityJourneyVariantPlan = {
  _id: string;
  language?: string;
  variantId?: string;
  levels?: SanityJourneyLevelPlan[];
};

function normalizeLevel(level: SanityJourneyLevelPlan): JourneyLevelPlan | null {
  if (!level.id || !level.title || !level.subtitle || !Array.isArray(level.topics)) return null;
  const topics = level.topics
    .filter((topic): topic is Required<Pick<SanityJourneyTopicPlan, "slug" | "label" | "storyTarget">> =>
      Boolean(topic.slug && topic.label && typeof topic.storyTarget === "number")
    )
    .map((topic) => ({
      slug: topic.slug,
      label: topic.label,
      storyTarget: topic.storyTarget,
      checkpoint: "mixed" as const,
    }));

  return {
    id: level.id,
    title: level.title,
    subtitle: level.subtitle,
    topicTarget:
      typeof level.topicTarget === "number" && Number.isFinite(level.topicTarget)
        ? level.topicTarget
        : topics.length,
    storyTargetPerTopic:
      typeof level.storyTargetPerTopic === "number" && Number.isFinite(level.storyTargetPerTopic)
        ? level.storyTargetPerTopic
        : 1,
    topics,
  };
}

function normalizeVariant(doc: SanityJourneyVariantPlan): JourneyVariantPlan | null {
  if (!doc.language || !doc.variantId || !Array.isArray(doc.levels)) return null;
  const levels = doc.levels.map(normalizeLevel).filter(Boolean) as JourneyLevelPlan[];
  if (!levels.length) return null;
  return {
    language: doc.language,
    variantId: doc.variantId,
    levels,
  };
}

const getPublishedCurriculumCached = unstable_cache(
  async (): Promise<JourneyVariantPlan[]> => {
    const docs = await freshClient.fetch<SanityJourneyVariantPlan[]>(
      `*[_type == "journeyVariantPlan"] | order(language asc, variantId asc){
        _id,
        language,
        variantId,
        levels[]{
          id,
          title,
          subtitle,
          topicTarget,
          storyTargetPerTopic,
          topics[]{
            slug,
            label,
            storyTarget
          }
        }
      }`
    );

    const normalized = docs.map(normalizeVariant).filter(Boolean) as JourneyVariantPlan[];
    return normalized.length ? normalized : FALLBACK_CURRICULUM;
  },
  ["journey-curriculum-v2"],
  { revalidate: 60, tags: ["journey-curriculum"] }
);

export async function getJourneyCurriculumPlans(): Promise<JourneyVariantPlan[]> {
  return getPublishedCurriculumCached();
}

export async function getJourneyVariantPlanAsync(
  language: string,
  variantId: string
): Promise<JourneyVariantPlan | null> {
  const plans = await getJourneyCurriculumPlans();
  const normalizedLanguage = language.trim().toLowerCase();
  const normalizedVariant = variantId.trim().toLowerCase();
  return (
    plans.find(
      (plan) =>
        plan.language.trim().toLowerCase() === normalizedLanguage &&
        plan.variantId.trim().toLowerCase() === normalizedVariant
    ) ?? null
  );
}

export async function getJourneyLevelPlanAsync(
  language: string,
  variantId: string,
  levelId: string
): Promise<JourneyLevelPlan | null> {
  const variant = await getJourneyVariantPlanAsync(language, variantId);
  if (!variant) return null;
  return variant.levels.find((level) => level.id === levelId) ?? null;
}

export async function listJourneyVariantPlansForStudio(): Promise<JourneyVariantPlan[]> {
  const docs = await rawServerClient.fetch<SanityJourneyVariantPlan[]>(
    `*[_type == "journeyVariantPlan"] | order(language asc, variantId asc){
      _id,
      language,
      variantId,
      levels[]{
        id,
        title,
        subtitle,
        topicTarget,
        storyTargetPerTopic,
        topics[]{
          slug,
          label,
          storyTarget
        }
      }
    }`
  );
  const normalized = docs.map(normalizeVariant).filter(Boolean) as JourneyVariantPlan[];
  return normalized.length ? normalized : FALLBACK_CURRICULUM;
}

export async function getJourneyVariantPlanForStudio(
  language: string,
  variantId: string
): Promise<JourneyVariantPlan | null> {
  const plans = await listJourneyVariantPlansForStudio();
  return (
    plans.find(
      (plan) =>
        plan.language.trim().toLowerCase() === language.trim().toLowerCase() &&
        plan.variantId.trim().toLowerCase() === variantId.trim().toLowerCase()
    ) ?? null
  );
}

export async function saveJourneyVariantPlanForStudio(plan: JourneyVariantPlan): Promise<void> {
  const docId = `journey-variant-plan.${plan.language.toLowerCase()}.${plan.variantId.toLowerCase()}`;
  await writeClient.createOrReplace({
    _id: docId,
    _type: "journeyVariantPlan",
    language: plan.language,
    variantId: plan.variantId,
    levels: plan.levels.map((level) => ({
      _type: "journeyLevelPlan",
      id: level.id,
      title: level.title,
      subtitle: level.subtitle,
      topicTarget: level.topicTarget,
      storyTargetPerTopic: level.storyTargetPerTopic,
      topics: level.topics.map((topic) => ({
        _type: "journeyTopicPlan",
        slug: topic.slug,
        label: topic.label,
        storyTarget: topic.storyTarget,
      })),
    })),
  });
}
