import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { getPublicUserStories } from "@/lib/userStories";
import {
  getPublishedStandaloneStories,
  isJourneyAssignedStandaloneStory,
} from "@/lib/standaloneStories";
import StoryVerticalCard from "@/components/StoryVerticalCard";
export const revalidate = 300;

type ExplorePolyglotStoriesPageProps = {
  searchParams: Promise<{ topic?: string; language?: string; region?: string }>;
};

function normalizeTopicKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
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

export default async function ExplorePolyglotStoriesPage({
  searchParams,
}: ExplorePolyglotStoriesPageProps) {
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

  const [userStories, standaloneStories] = await Promise.all([
    getPublicUserStories(),
    getPublishedStandaloneStories(),
  ]);
  const normalized = [...userStories, ...standaloneStories.filter((story) => !isJourneyAssignedStandaloneStory(story))]
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title ?? "Untitled story",
      language: s.language ?? "",
      region: s.region ?? "",
      level: s.level ?? "",
      topic: s.topic ?? "",
      themes: Array.isArray((s as { theme?: unknown }).theme)
        ? ((s as { theme?: unknown }).theme as unknown[])
            .filter((value): value is string => typeof value === "string")
        : [],
      text: s.text ?? "",
      coverUrl: s.coverUrl?.trim() ? s.coverUrl : "/covers/default.jpg",
      createdAt:
        s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt ?? ""),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const languageFilteredStories = languageKey
    ? normalized.filter((s) => normalizeTopicKey(s.language ?? "") === languageKey)
    : preferredLanguageKeys
      ? normalized.filter((s) => preferredLanguageKeys.has(normalizeTopicKey(s.language ?? "")))
      : normalized;
  const regionFilteredStories = regionKey
    ? languageFilteredStories.filter((s) => normalizeTopicKey(s.region ?? "") === regionKey)
    : languageFilteredStories;
  const filteredStories = topicKey
    ? regionFilteredStories.filter((s) =>
        [...toTopicList(s.topic), ...toTopicList(s.themes)].some(
          (topicValue) => normalizeTopicKey(topicValue) === topicKey
        )
      )
    : regionFilteredStories;

  return (
    <div className="max-w-6xl mx-auto p-8 text-[var(--foreground)]">
      <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Individual Stories</h1>
        <Link href="/explore" className="text-sm text-white/90 hover:text-white">
          Back to Explore
        </Link>
      </div>

      {filteredStories.length === 0 ? (
        <p className="text-[var(--muted)]">No stories found.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map((story) => (
            <StoryVerticalCard
              key={story.id}
              href={`/stories/${story.slug}?returnTo=/explore/polyglot-stories&returnLabel=Individual%20Stories`}
              title={story.title}
              coverUrl={story.coverUrl}
              level={story.level}
              language={story.language}
              region={story.region}
              excerpt={`${stripHtml(story.text).slice(0, 140)}...`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
