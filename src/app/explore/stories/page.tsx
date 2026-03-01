import Link from "next/link";
import { books } from "@/data/books";
import { currentUser } from "@clerk/nextjs/server";

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

  for (const book of Object.values(books) as Array<Record<string, unknown>>) {
    const bookSlug = typeof book["slug"] === "string" ? book["slug"] : "";
    if (!bookSlug) continue;

    const bookTitle = typeof book["title"] === "string" ? book["title"] : bookSlug;
    const bookLanguage = typeof book["language"] === "string" ? book["language"] : "";
    const bookLevel = typeof book["level"] === "string" ? book["level"] : "";
    const bookCover = typeof book["cover"] === "string" ? book["cover"] : "/covers/default.jpg";
    const bookTopics = [
      ...toTopicList(book["topic"]),
      ...toTopicList(book["theme"]),
      ...toTopicList(book["tags"]),
    ];

    const stories = book["stories"];
    if (!Array.isArray(stories)) continue;

    stories.forEach((story, idx) => {
      if (typeof story !== "object" || story === null) return;
      const s = story as Record<string, unknown>;
      const storySlug = typeof s["slug"] === "string" ? s["slug"] : "";
      if (!storySlug) return;

      const storyTitle = typeof s["title"] === "string" ? s["title"] : "Untitled story";
      const storyLanguage = typeof s["language"] === "string" ? s["language"] : bookLanguage;
      const storyLevel = typeof s["level"] === "string" ? s["level"] : bookLevel;
      const storyCover =
        typeof s["cover"] === "string" && s["cover"].trim() !== "" ? s["cover"] : bookCover;
      const storyTopics = [...toTopicList(s["topic"]), ...toTopicList(s["tags"]), ...bookTopics];

      out.push({
        id: `${bookSlug}:${storySlug}:${idx}`,
        bookSlug,
        bookTitle,
        storySlug,
        storyTitle,
        language: storyLanguage,
        level: storyLevel,
        coverUrl: storyCover,
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
        <Link href="/explore" className="text-sm text-emerald-300 hover:text-emerald-200">
          Back to Explore
        </Link>
      </div>

      {filteredStories.length === 0 ? (
        <p className="text-gray-400">No stories found.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map((story) => (
            <Link
              key={story.id}
              href={`/books/${story.bookSlug}/${story.storySlug}?returnTo=/explore/stories&returnLabel=All%20Stories`}
              className="flex flex-col bg-white/5 hover:bg-white/10 transition-all duration-200 rounded-2xl overflow-hidden shadow-md"
            >
              <div className="w-full h-48 bg-gray-800">
                <img
                  src={story.coverUrl || "/covers/default.jpg"}
                  alt={story.storyTitle}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col justify-between flex-1">
                <div>
                  <h2 className="text-xl font-semibold line-clamp-2">{story.storyTitle}</h2>
                  <p className="mt-1 text-sm text-sky-300 line-clamp-1">{story.bookTitle}</p>
                </div>
                <p className="mt-3 text-sm text-gray-400">
                  {story.language || "—"} · {story.level || "—"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
