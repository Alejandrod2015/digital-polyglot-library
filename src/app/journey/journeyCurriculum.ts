export type JourneyTopicPlan = {
  slug: string;
  label: string;
  storyTarget: number;
  checkpoint: "mixed";
  storyKeys?: string[];
};

export type JourneyLevelPlan = {
  id: string;
  title: string;
  subtitle: string;
  topicTarget: number;
  storyTargetPerTopic: number;
  topics: JourneyTopicPlan[];
};

export type JourneyVariantPlan = {
  language: string;
  variantId: string;
  levels: JourneyLevelPlan[];
};

const a1LatamTopics: JourneyTopicPlan[] = [
  {
    slug: "festivals-community",
    label: "Festivals & Community",
    storyTarget: 4,
    checkpoint: "mixed",
    storyKeys: [
      "colombian-spanish-stories-for-beginners:el-baile-en-la-plaza",
      "colombian-spanish-stories-for-beginners:el-carnaval-de-barranquilla",
      "colombian-spanish-stories-for-beginners:la-feria-de-las-flores",
      "colombian-spanish-stories-for-beginners:la-fiesta-en-cartagena",
    ],
  },
  {
    slug: "legends-folklore",
    label: "Legends & Folklore",
    storyTarget: 4,
    checkpoint: "mixed",
    storyKeys: [
      "colombian-spanish-stories-for-beginners:la-leyenda-de-el-dorado",
      "colombian-spanish-stories-for-beginners:la-leyenda-de-la-llorona",
      "colombian-spanish-stories-for-beginners:la-leyenda-de-bochica",
      "colombian-spanish-stories-for-beginners:la-leyenda-del-mohan",
    ],
  },
  {
    slug: "nature-adventure",
    label: "Nature & Adventure",
    storyTarget: 4,
    checkpoint: "mixed",
    storyKeys: [
      "colombian-spanish-stories-for-beginners:una-aventura-en-el-amazonas",
      "colombian-spanish-stories-for-beginners:la-excursion-a-la-sierra-nevada",
      "colombian-spanish-stories-for-beginners:la-finca-en-la-montana",
      "colombian-spanish-stories-for-beginners:el-rescate-en-la-laguna",
    ],
  },
  {
    slug: "food-daily-life",
    label: "Food & Daily Life",
    storyTarget: 4,
    checkpoint: "mixed",
    storyKeys: [
      "colombian-spanish-stories-for-beginners:el-mercado-de-medellin",
      "colombian-spanish-stories-for-beginners:el-secreto-del-cafe",
      "colombian-spanish-stories-for-beginners:el-festival-de-la-arepa",
      "colombian-spanish-stories-for-beginners:el-misterio-del-bosque",
    ],
  },
  {
    slug: "places-getting-around",
    label: "Places & Getting Around",
    storyTarget: 4,
    checkpoint: "mixed",
    storyKeys: [
      "colombian-spanish-stories-for-beginners:el-tren-de-la-sabana",
      "colombian-spanish-stories-for-beginners:el-viaje-a-villa-de-leyva",
      "colombian-spanish-stories-for-beginners:el-tesoro-escondido",
      "colombian-spanish-stories-for-beginners:el-misterio-de-la-catedral-de-sal",
    ],
  },
];

const a1SpainTopics: JourneyTopicPlan[] = [
  { slug: "culture-traditions", label: "Culture & Traditions", storyTarget: 6, checkpoint: "mixed" },
  { slug: "food-cooking", label: "Food & Cooking", storyTarget: 6, checkpoint: "mixed" },
  { slug: "cities-places", label: "Cities & Places", storyTarget: 6, checkpoint: "mixed" },
  { slug: "travel-transport", label: "Travel & Transport", storyTarget: 6, checkpoint: "mixed" },
  { slug: "work-daily-life", label: "Work & Daily Life", storyTarget: 6, checkpoint: "mixed" },
  { slug: "family-community", label: "Family & Community", storyTarget: 6, checkpoint: "mixed" },
  { slug: "nature-environment", label: "Nature & Environment", storyTarget: 6, checkpoint: "mixed" },
  { slug: "everyday-life", label: "Everyday Life", storyTarget: 6, checkpoint: "mixed" },
];

export const JOURNEY_CURRICULUM: JourneyVariantPlan[] = [
  {
    language: "Spanish",
    variantId: "latam",
    levels: [
      {
        id: "a1",
        title: "A1",
        subtitle: "First steps",
        topicTarget: 5,
        storyTargetPerTopic: 4,
        topics: a1LatamTopics,
      },
    ],
  },
  {
    language: "Spanish",
    variantId: "spain",
    levels: [
      {
        id: "a1",
        title: "A1",
        subtitle: "First steps",
        topicTarget: 8,
        storyTargetPerTopic: 6,
        topics: a1SpainTopics,
      },
    ],
  },
];

export function getJourneyVariantPlan(language: string, variantId: string): JourneyVariantPlan | null {
  const normalizedLanguage = language.trim().toLowerCase();
  const normalizedVariant = variantId.trim().toLowerCase();

  return (
    JOURNEY_CURRICULUM.find(
      (plan) =>
        plan.language.trim().toLowerCase() === normalizedLanguage &&
        plan.variantId.trim().toLowerCase() === normalizedVariant
    ) ?? null
  );
}

export function getJourneyLevelPlan(language: string, variantId: string, levelId: string): JourneyLevelPlan | null {
  const variantPlan = getJourneyVariantPlan(language, variantId);
  if (!variantPlan) return null;
  return variantPlan.levels.find((level) => level.id === levelId) ?? null;
}

export function getJourneyTopicOptions(
  language: string,
  variantId: string,
  levelId: string
): Array<{ title: string; value: string }> {
  const levelPlan = getJourneyLevelPlan(language, variantId, levelId);
  if (!levelPlan) return [];

  return levelPlan.topics.map((topic) => ({
    title: topic.label,
    value: topic.slug,
  }));
}
