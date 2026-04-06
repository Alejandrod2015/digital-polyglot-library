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
  journeyType?: string;
  levels: JourneyLevelPlan[];
};

function topic(
  slug: string,
  label: string,
  storyTarget = 1,
  storyKeys?: string[]
): JourneyTopicPlan {
  return {
    slug,
    label,
    storyTarget,
    checkpoint: "mixed",
    ...(storyKeys ? { storyKeys } : {}),
  };
}

const a1LatamTopics: JourneyTopicPlan[] = [
  topic("community-celebrations", "Community & Celebrations", 1, [
    "colombian-spanish-stories-for-beginners:el-baile-en-la-plaza",
    "colombian-spanish-stories-for-beginners:el-carnaval-de-barranquilla",
    "colombian-spanish-stories-for-beginners:la-feria-de-las-flores",
    "colombian-spanish-stories-for-beginners:la-fiesta-en-cartagena",
  ]),
  topic("food-daily-life", "Food & Everyday Life", 1, [
    "colombian-spanish-stories-for-beginners:el-mercado-de-medellin",
    "colombian-spanish-stories-for-beginners:el-secreto-del-cafe",
    "colombian-spanish-stories-for-beginners:el-festival-de-la-arepa",
    "colombian-spanish-stories-for-beginners:el-misterio-del-bosque",
  ]),
  topic("places-getting-around", "Places & Getting Around", 1, [
    "colombian-spanish-stories-for-beginners:el-tren-de-la-sabana",
    "colombian-spanish-stories-for-beginners:el-viaje-a-villa-de-leyva",
    "colombian-spanish-stories-for-beginners:el-tesoro-escondido",
    "colombian-spanish-stories-for-beginners:el-misterio-de-la-catedral-de-sal",
  ]),
  topic("home-family", "Home & Family", 1),
  topic("nature-adventure", "Nature & Adventure", 1, [
    "colombian-spanish-stories-for-beginners:una-aventura-en-el-amazonas",
    "colombian-spanish-stories-for-beginners:la-excursion-a-la-sierra-nevada",
    "colombian-spanish-stories-for-beginners:la-finca-en-la-montana",
    "colombian-spanish-stories-for-beginners:el-rescate-en-la-laguna",
  ]),
  topic("legends-folklore", "Legends & Folklore", 1, [
    "colombian-spanish-stories-for-beginners:la-leyenda-de-el-dorado",
    "colombian-spanish-stories-for-beginners:la-leyenda-de-la-llorona",
    "colombian-spanish-stories-for-beginners:la-leyenda-de-bochica",
    "colombian-spanish-stories-for-beginners:la-leyenda-del-mohan",
  ]),
];

const a2LatamTopics: JourneyTopicPlan[] = [
  topic("work-study", "Work & Study"),
  topic("travel-plans", "Travel & Plans"),
  topic("health-wellbeing", "Health & Wellbeing"),
  topic("city-life-services", "City Life & Services"),
  topic("relationships-feelings", "Relationships & Feelings"),
  topic("traditions-daily-culture", "Traditions & Daily Culture"),
];

const b1LatamTopics: JourneyTopicPlan[] = [
  topic("opinions-life-choices", "Opinions & Life Choices"),
  topic("media-technology", "Media & Technology"),
  topic("identity-belonging", "Identity & Belonging"),
  topic("work-ambition", "Work & Ambition"),
  topic("money-everyday-decisions", "Money & Everyday Decisions"),
  topic("society-rules", "Society & Rules"),
  topic("memory-personal-history", "Memory & Personal History"),
  topic("change-new-stages", "Change & New Stages"),
];

const b2LatamTopics: JourneyTopicPlan[] = [
  topic("public-life-institutions", "Public Life & Institutions"),
  topic("values-responsibility", "Values & Responsibility"),
  topic("art-creativity", "Art & Creativity"),
  topic("science-innovation", "Science & Innovation"),
  topic("migration-belonging", "Migration & Belonging"),
  topic("urban-life-opportunity", "Urban Life & Opportunity"),
  topic("communication-influence", "Communication & Influence"),
  topic("relationships-conflict", "Relationships & Conflict"),
];

const c1LatamTopics: JourneyTopicPlan[] = [
  topic("society-change", "Society & Change"),
  topic("culture-ideas", "Culture & Ideas"),
  topic("language-identity", "Language & Identity"),
  topic("work-money-daily-life", "Work, Money & Daily Life"),
  topic("technology-human-experience", "Technology & Human Experience"),
  topic("stories-memory-perspective", "Stories, Memory & Perspective"),
];

const c2LatamTopics: JourneyTopicPlan[] = [
  topic("complex-social-worlds", "Complex Social Worlds"),
  topic("culture-meaning", "Culture & Meaning"),
  topic("public-voice-influence", "Public Voice & Influence"),
  topic("intellectual-life-ideas", "Intellectual Life & Ideas"),
  topic("identity-memory-place", "Identity, Memory & Place"),
];

const a1SpainTopics: JourneyTopicPlan[] = [
  topic("culture-traditions", "Culture & Traditions", 1),
  topic("food-cooking", "Food & Cooking", 1),
  topic("cities-places", "Cities & Places", 1),
  topic("travel-transport", "Travel & Transport", 1),
  topic("work-daily-life", "Work & Daily Life", 1),
  topic("family-community", "Family & Community", 1),
  topic("nature-environment", "Nature & Environment", 1),
  topic("everyday-life", "Everyday Life", 1),
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
        topicTarget: a1LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: a1LatamTopics,
      },
      {
        id: "a2",
        title: "A2",
        subtitle: "Building confidence",
        topicTarget: a2LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: a2LatamTopics,
      },
      {
        id: "b1",
        title: "B1",
        subtitle: "Everyday confidence",
        topicTarget: b1LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: b1LatamTopics,
      },
      {
        id: "b2",
        title: "B2",
        subtitle: "Richer expression",
        topicTarget: b2LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: b2LatamTopics,
      },
      {
        id: "c1",
        title: "C1",
        subtitle: "Nuanced language",
        topicTarget: c1LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: c1LatamTopics,
      },
      {
        id: "c2",
        title: "C2",
        subtitle: "Near-native command",
        topicTarget: c2LatamTopics.length,
        storyTargetPerTopic: 1,
        topics: c2LatamTopics,
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
        topicTarget: a1SpainTopics.length,
        storyTargetPerTopic: 1,
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

  return levelPlan.topics.map((journeyTopic) => ({
    title: journeyTopic.label,
    value: journeyTopic.slug,
  }));
}
