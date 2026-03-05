import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { getPublicUserStories } from "@/lib/userStories";
import StoryVerticalCard from "@/components/StoryVerticalCard";

type ExplorePolyglotStoriesPageProps = {
  searchParams: Promise<{ topic?: string }>;
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

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export default async function ExplorePolyglotStoriesPage({
  searchParams,
}: ExplorePolyglotStoriesPageProps) {
  const { topic } = await searchParams;
  const topicKey = normalizeTopicKey(topic ?? "");

  const user = await currentUser();
  const targetLanguagesUnknown = (user?.publicMetadata?.targetLanguages as unknown) ?? [];
  const targetLanguages =
    isStringArray(targetLanguagesUnknown) && targetLanguagesUnknown.length > 0
      ? new Set(targetLanguagesUnknown.map((l) => l.toLowerCase()))
      : null;

  const stories = await getPublicUserStories();
  const normalized = stories.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title ?? "Untitled story",
    language: s.language ?? "",
    region: s.region ?? "",
    level: s.level ?? "",
    topic: s.topic ?? "",
    text: s.text ?? "",
    coverUrl: s.coverUrl?.trim() ? s.coverUrl : "/covers/default.jpg",
  }));

  const filteredByLanguage = targetLanguages
    ? normalized.filter((s) => targetLanguages.has((s.language ?? "").toLowerCase()))
    : normalized;
  const filteredStories = topicKey
    ? filteredByLanguage.filter((s) => normalizeTopicKey(s.topic ?? "") === topicKey)
    : filteredByLanguage;

  return (
    <div className="max-w-6xl mx-auto p-8 text-[var(--foreground)]">
      <div className="mb-6 md:mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">All Polyglot Stories</h1>
        <Link href="/explore" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
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
              href={`/stories/${story.slug}?returnTo=/explore/polyglot-stories&returnLabel=Polyglot%20Stories`}
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
