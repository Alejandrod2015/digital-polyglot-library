import { books } from "@/data/books";
import { CEFR_LEVEL_LABELS, type CefrLevel, type Level, type Story } from "@/types/books";

export type AtlasStoryItem = {
  id: string;
  title: string;
  href: string;
  coverUrl?: string;
  bookTitle: string;
  language?: string;
  region?: string;
  levelLabel: string;
  topicLabel: string;
};

export type AtlasTopic = {
  id: string;
  slug: string;
  label: string;
  storyCount: number;
  stories: AtlasStoryItem[];
};

export type AtlasLevel = {
  id: string;
  title: string;
  subtitle: string;
  topics: AtlasTopic[];
};

const atlasLevelMeta: Record<CefrLevel, { id: string; title: string; subtitle: string }> = {
  a1: { id: "a1", title: "A1", subtitle: "First steps" },
  a2: { id: "a2", title: "A2", subtitle: "Building confidence" },
  b1: { id: "b1", title: "B1", subtitle: "Everyday confidence" },
  b2: { id: "b2", title: "B2", subtitle: "Richer expression" },
  c1: { id: "c1", title: "C1", subtitle: "Nuanced language" },
  c2: { id: "c2", title: "C2", subtitle: "Near-native command" },
};

const legacyLevelFallback: Record<Level, CefrLevel> = {
  beginner: "a1",
  intermediate: "b1",
  advanced: "c1",
};

function resolveCefrLevel(story: Story, bookLevel: Level, bookCefrLevel?: CefrLevel): CefrLevel {
  return story.cefrLevel ?? bookCefrLevel ?? legacyLevelFallback[story.level ?? bookLevel];
}

function normalizeTopic(topic?: string | null) {
  return (topic ?? "").trim();
}

function formatTopicLabel(topic: string) {
  return topic
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyTopic(topic: string) {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickTopic(story: Story, fallbackTopic?: string | null) {
  const direct = normalizeTopic(story.topic);
  if (direct) return formatTopicLabel(direct);

  const tags = Array.isArray(story.tags) ? story.tags.find((tag) => normalizeTopic(tag)) : null;
  if (tags) return formatTopicLabel(tags);

  const fallback = normalizeTopic(fallbackTopic);
  if (fallback) return formatTopicLabel(fallback);

  return "Everyday life";
}

export function buildAtlasLevels(): AtlasLevel[] {
  const grouped = new Map<string, Map<string, AtlasStoryItem[]>>();

  for (const book of Object.values(books)) {
    const bookCefrLevel = book.cefrLevel ?? legacyLevelFallback[book.level];
    const bookLevel = atlasLevelMeta[bookCefrLevel];

    if (!grouped.has(bookLevel.id)) {
      grouped.set(bookLevel.id, new Map());
    }

    for (const story of book.stories) {
      const resolvedCefrLevel = resolveCefrLevel(story, book.level, book.cefrLevel);
      const mappedLevel = atlasLevelMeta[resolvedCefrLevel];
      if (!mappedLevel) continue;

      if (!grouped.has(mappedLevel.id)) {
        grouped.set(mappedLevel.id, new Map());
      }

      const targetTopics = grouped.get(mappedLevel.id)!;
      const topicLabel = pickTopic(story, book.topic);

      if (!targetTopics.has(topicLabel)) {
        targetTopics.set(topicLabel, []);
      }

      const items = targetTopics.get(topicLabel)!;
      if (items.length >= 10) continue;

      items.push({
        id: `${book.slug}:${story.slug}`,
        title: story.title,
        href: `/books/${book.slug}/${story.slug}`,
        coverUrl: story.cover ?? book.cover,
        bookTitle: book.title,
        language: story.language ?? book.language,
        region: story.region ?? book.region,
        levelLabel: CEFR_LEVEL_LABELS[resolvedCefrLevel],
        topicLabel,
      });
    }
  }

  return Object.entries(atlasLevelMeta)
    .map(([, meta]) => {
      const topicsMap = grouped.get(meta.id) ?? new Map<string, AtlasStoryItem[]>();

      const topics = Array.from(topicsMap.entries())
        .map(([label, stories]) => ({
          id: `${meta.id}:${slugifyTopic(label)}`,
          slug: slugifyTopic(label),
          label,
          storyCount: stories.length,
          stories,
        }) satisfies AtlasTopic)
        .sort((a, b) => {
          if (b.storyCount !== a.storyCount) return b.storyCount - a.storyCount;
          return a.label.localeCompare(b.label);
        });

      return {
        id: meta.id,
        title: meta.title,
        subtitle: meta.subtitle,
        topics,
      } satisfies AtlasLevel;
    })
    .filter((level) => level.topics.length > 0);
}
