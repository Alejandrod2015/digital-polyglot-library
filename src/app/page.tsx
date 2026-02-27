// /src/app/page.tsx (server)
import HomeClient from "./HomeClient";
import { getLatestHomeReleases } from "@/lib/homeReleases";

export const revalidate = 300;

export default async function HomePage() {
  const { latestBooks, latestStories, latestPolyglotStories } =
    await getLatestHomeReleases({ limit: 10 });

  return (
    <HomeClient
      latestBooks={latestBooks}
      latestStories={latestStories}
      latestPolyglotStories={latestPolyglotStories}
    />
  );
}