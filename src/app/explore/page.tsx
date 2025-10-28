import ExploreClient from "./ExploreClient";
import { getPublicUserStories } from "@/lib/userStories";

export const revalidate = 600;

export default async function ExplorePage() {
  const stories = await getPublicUserStories();

  // Aseguramos serialización completa (Next ignora Date, nulls o undefined)
  const polyglotStories = stories.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title ?? "",
    language: s.language ?? "",
    level: s.level ?? "",
    text: s.text ?? "",
    coverUrl: s.coverUrl && s.coverUrl.trim() !== "" 
      ? s.coverUrl 
      : "/covers/default.png",
  }));

  return <ExploreClient polyglotStories={polyglotStories} />;
}
