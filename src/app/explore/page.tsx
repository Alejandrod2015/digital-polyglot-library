import ExploreClient from "./ExploreClient";
import { getPublicUserStories } from "@/lib/userStories";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const stories = await getPublicUserStories();

  const polyglotStories = stories.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title ?? "",
    language: s.language ?? "",
    level: s.level ?? "",
    text: s.text ?? "",
    coverUrl:
      typeof s.coverUrl === "string" && s.coverUrl.trim() !== ""
        ? s.coverUrl
        : "/covers/default.jpg",
  }));

  return <ExploreClient polyglotStories={polyglotStories} />;
}
