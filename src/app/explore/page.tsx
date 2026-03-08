import ExploreClient from "./ExploreClient";
import { getPublicUserStories } from "@/lib/userStories";
import { getPublishedStandaloneStories } from "@/lib/standaloneStories";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [userStories, standaloneStories] = await Promise.all([
    getPublicUserStories(),
    getPublishedStandaloneStories(),
  ]);

  const polyglotStories = [...userStories, ...standaloneStories]
    .map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title ?? "",
      language: s.language ?? "",
      region: s.region ?? "",
      level: s.level ?? "",
      topic: s.topic ?? "",
      themes: Array.isArray((s as { theme?: unknown }).theme)
        ? ((s as { theme?: unknown }).theme as unknown[])
            .filter((value): value is string => typeof value === "string")
        : [],
      text: s.text ?? "",
      coverUrl:
        typeof s.coverUrl === "string" && s.coverUrl.trim() !== ""
          ? s.coverUrl
          : "/covers/default.jpg",
      createdAt:
        s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt ?? ""),
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return <ExploreClient polyglotStories={polyglotStories} />;
}
