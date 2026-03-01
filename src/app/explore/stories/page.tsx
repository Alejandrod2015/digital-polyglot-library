import Link from "next/link";
import { books } from "@/data/books";
import { currentUser } from "@clerk/nextjs/server";
import type { Book, Story } from "@/types/books";
import ExploreStoryCardsClient from "@/components/ExploreStoryCardsClient";

type ExploreStoriesPageProps = {
  searchParams: Promise<{ topic?: string }>;
};

type StoryItem = {
  id: string;
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language: string;
  level: string;
  coverUrl: string;
  audioSrc?: string;
  topic?: string;
  topics: string[];
};

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === "string");
}

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
        ? book.cover
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
      const storyLevel = typeof story.level === "string" ? story.level : bookLevel;
      const storyCover =
        typeof story.cover === "string" && story.cover.trim() !== ""
          ? story.cover
          : bookCover;
      const rawAudio = typeof story.audio === "string" ? story.audio.trim() : "";
      const storyAudio = rawAudio
        ? rawAudio.startsWith("http")
          ? rawAudio
          : `https://cdn.sanity.io/files/9u7ilulp/production/${rawAudio}.mp3`
        : undefined;
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
  const { topic } = await searchParams;
  const topicKey = normalizeTopicKey(topic ?? "");

  const user = await currentUser();
  const targetLanguagesUnknown = (user?.publicMetadata?.targetLanguages as unknown) ?? [];
  const targetLanguages =
    isStringArray(targetLanguagesUnknown) && targetLanguagesUnknown.length > 0
      ? new Set(targetLanguagesUnknown.map((l) => l.toLowerCase()))
      : null;

  const allStories = extractStories();
  const filteredByLanguage = targetLanguages
    ? allStories.filter((s) => targetLanguages.has((s.language ?? "").toLowerCase()))
    : allStories;
  const filteredStories = topicKey
    ? filteredByLanguage.filter((s) =>
        s.topics.some((t) => normalizeTopicKey(t) === topicKey)
      )
    : filteredByLanguage;

  return (
    <div className="max-w-6xl mx-auto p-8 text-white">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Stories</h1>
        <Link href="/explore" className="text-sm text-gray-200 hover:text-white">
          Back to Explore
        </Link>
      </div>

      {filteredStories.length === 0 ? (
        <p className="text-gray-400">No stories found.</p>
      ) : (
        <ExploreStoryCardsClient
          items={filteredStories.map((story) => ({
            id: story.id,
            href: `/books/${story.bookSlug}/${story.storySlug}?returnTo=/explore/stories&returnLabel=All%20Stories`,
            title: story.storyTitle,
            subtitle: story.bookTitle,
            coverUrl: story.coverUrl,
            language: story.language,
            level: story.level,
            topic: story.topic,
            audioSrc: story.audioSrc,
          }))}
        />
      )}
    </div>
  );
}
