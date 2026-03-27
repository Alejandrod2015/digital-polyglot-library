import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { books } from "@/data/books";
import type { Book, Story } from "@/types/books";
import ExploreStoryCardsClient from "@/components/ExploreStoryCardsClient";
import {
  getPublishedStandaloneStories,
  isJourneyAssignedStandaloneStory,
} from "@/lib/standaloneStories";
import { resolveCatalogAudioUrl, resolvePublicMediaUrl } from "@/lib/publicMedia";
export const revalidate = 300;

type ExploreStoriesPageProps = {
  searchParams: Promise<{ topic?: string; language?: string; region?: string }>;
};

type StoryItem = {
  id: string;
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language: string;
  region?: string;
  level: string;
  coverUrl: string;
  audioSrc?: string;
  topic?: string;
  topics: string[];
};

function normalizeTopicKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTopicList(value: unknown): string[] {
  if (typeof value === "string") {
    const v = value.trim();
    return v ? [v] : [];
  }
  if (Array.isArray(value)) {
    return value.filter((i): i is string => typeof i === "string" && i.trim() !== "");
  }
  return [];
}

function toLanguageKeys(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const keys = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeTopicKey(item))
    .filter(Boolean);
  return keys.length > 0 ? new Set(keys) : null;
}

function extractStories(): StoryItem[] {
  const out: StoryItem[] = [];

  for (const book of Object.values(books) as Book[]) {
    const bookSlug = book.slug;
    if (!bookSlug) continue;

    const bookTitle = book.title || bookSlug;
    const bookLanguage = typeof book.language === "string" ? book.language : "";
    const bookLevel = typeof book.level === "string" ? book.level : "";
    const bookCover =
      typeof book.cover === "string" && book.cover.trim() !== ""
        ? resolvePublicMediaUrl(book.cover) ?? book.cover
        : "/covers/default.jpg";
    const bookTopics = [
      ...toTopicList(book.topic),
      ...toTopicList(book.theme),
    ];

    const stories = Array.isArray(book.stories) ? book.stories : [];

    stories.forEach((story: Story, idx) => {
      const storySlug = typeof story.slug === "string" ? story.slug : "";
      if (!storySlug) return;

      const storyTitle = typeof story.title === "string" ? story.title : "Untitled story";
      const storyLanguage =
        typeof story.language === "string" ? story.language : bookLanguage;
      const storyRegion =
        typeof story.region === "string" && story.region.trim() !== ""
          ? story.region
          : typeof book.region === "string"
            ? book.region
            : undefined;
      const storyLevel = typeof story.level === "string" ? story.level : bookLevel;
      const storyCover =
        typeof story.cover === "string" && story.cover.trim() !== ""
          ? resolvePublicMediaUrl(story.cover) ?? story.cover
          : bookCover;
      const rawAudio = typeof story.audio === "string" ? story.audio.trim() : "";
      const storyAudio = resolveCatalogAudioUrl(rawAudio);
      const storyTopics = [
        ...toTopicList(story.topic),
        ...toTopicList(story.tags),
        ...bookTopics,
      ];

      out.push({
        id: `${bookSlug}:${storySlug}:${idx}`,
        bookSlug,
        bookTitle,
        storySlug,
        storyTitle,
        language: storyLanguage,
        region: storyRegion,
        level: storyLevel,
        coverUrl: storyCover,
        audioSrc: storyAudio,
        topic: typeof story.topic === "string" ? story.topic : book.topic,
        topics: storyTopics,
      });
    });
  }

  return out;
}

export default async function ExploreStoriesPage({ searchParams }: ExploreStoriesPageProps) {
  const [{ topic, language, region }, user] = await Promise.all([searchParams, currentUser()]);
  const topicKey = normalizeTopicKey(topic ?? "");
  const languageKey = normalizeTopicKey(language ?? "");
  const preferredLanguageKeys = toLanguageKeys(user?.publicMetadata?.targetLanguages);
  const regionKey = normalizeTopicKey(
    region ??
      (typeof user?.publicMetadata?.preferredRegion === "string"
        ? user.publicMetadata.preferredRegion
        : "")
  );

  const standaloneStories = await getPublishedStandaloneStories();
  const allStories = [
    ...extractStories(),
    ...standaloneStories
      .filter((story) => !isJourneyAssignedStandaloneStory(story))
      .map((story) => ({
      id: `standalone:${story.id}`,
      bookSlug: "standalone",
      bookTitle: "Individual Stories",
      storySlug: story.slug,
      storyTitle: story.title || "Untitled story",
      language: story.language ?? "",
      region: story.region ?? undefined,
      level: story.level ?? "",
      coverUrl: story.coverUrl?.trim() ? story.coverUrl : "/covers/default.jpg",
      audioSrc: story.audioUrl ?? undefined,
      topic: story.topic ?? undefined,
      topics: [...toTopicList(story.topic), ...toTopicList(story.theme)],
    })),
  ];
  const languageFilteredStories = languageKey
    ? allStories.filter((s) => normalizeTopicKey(s.language ?? "") === languageKey)
    : preferredLanguageKeys
      ? allStories.filter((s) => preferredLanguageKeys.has(normalizeTopicKey(s.language ?? "")))
      : allStories;
  const regionFilteredStories = regionKey
    ? languageFilteredStories.filter((s) => normalizeTopicKey(s.region ?? "") === regionKey)
    : languageFilteredStories;
  const filteredStories = topicKey
    ? regionFilteredStories.filter((s) =>
        s.topics.some((t) => normalizeTopicKey(t) === topicKey)
      )
    : regionFilteredStories;

  return (
    <div className="max-w-6xl mx-auto p-8 text-[var(--foreground)]">
      <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Stories</h1>
        <Link href="/explore" className="text-sm text-white/90 hover:text-white">
          Back to Explore
        </Link>
      </div>

      {filteredStories.length === 0 ? (
        <p className="text-[var(--muted)]">No stories found.</p>
      ) : (
        <ExploreStoryCardsClient
          items={filteredStories.map((story) => ({
            id: story.id,
            href:
              story.bookSlug === "standalone"
                ? `/stories/${story.storySlug}?returnTo=/explore/stories&returnLabel=All%20Stories`
                : `/books/${story.bookSlug}/${story.storySlug}?returnTo=/explore/stories&returnLabel=All%20Stories`,
            title: story.storyTitle,
            subtitle: story.bookTitle,
            coverUrl: story.coverUrl,
            language: story.language,
            region: story.region,
            level: story.level,
            topic: story.topic,
            audioSrc: story.audioSrc,
          }))}
        />
      )}
    </div>
  );
}
