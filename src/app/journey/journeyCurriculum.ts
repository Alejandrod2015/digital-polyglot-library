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

// LATAM a0/a1/a2 share the SAME 7 published topics, each with 3 stories (= 21).
// Verified against the DB on 2026-07-02: the three active LATAM journeys (a0,
// a1, a2) all carry these 7 topic slugs. Labels here drive the curated topic
// names in the app; when a DB topic has no curriculum match the UI falls back
// to a title-cased slug (e.g. "Meeting New People"). The old `storyKeys`
// entries were legacy Sanity references and are no longer read at runtime
// (grep: zero consumers), so they're dropped. Topic ORDER at runtime comes
// from `Journey.topics` in the DB, not from this array.
const latamCoreTopics: JourneyTopicPlan[] = [
  topic("food-everyday-life", "Food & Everyday Life", 3),
  topic("home-family", "Home & Family", 3),
  topic("meeting-new-people", "Meeting New People", 3),
  topic("places-getting-around", "Places & Getting Around", 3),
  topic("community-celebrations", "Community & Celebrations", 3),
  topic("nature-adventure", "Nature & Adventure", 3),
  topic("legends-folklore", "Legends & Folklore", 3),
];

// a1 and a2 are the same 7 topics in the published corpus today.
const a1LatamTopics: JourneyTopicPlan[] = latamCoreTopics;
const a2LatamTopics: JourneyTopicPlan[] = latamCoreTopics;

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
        storyTargetPerTopic: 3,
        topics: a1LatamTopics,
      },
      {
        id: "a2",
        title: "A2",
        subtitle: "Building confidence",
        topicTarget: a2LatamTopics.length,
        storyTargetPerTopic: 3,
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
