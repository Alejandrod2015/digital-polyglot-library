// /src/app/page.tsx (server)
import { auth } from "@clerk/nextjs/server";
import HomeClient from "./HomeClient";
import LandingPage from "@/components/LandingPage";
import { getLatestHomeReleases } from "@/lib/homeReleases";
import { getFeaturedStories } from "@/lib/getFeaturedStory";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  const [{ latestBooks, latestStories, latestPolyglotStories }, featured] = await Promise.all([
    getLatestHomeReleases({ limit: 10 }),
    getFeaturedStories(),
  ]);

  return (
    <HomeClient
      latestBooks={latestBooks}
      latestStories={latestStories}
      latestPolyglotStories={latestPolyglotStories}
      featuredWeekSlug={featured.week?.slug ?? null}
      featuredDaySlug={featured.day?.slug ?? null}
      initialPlan="free"
      initialTargetLanguages={[]}
      initialInterests={[]}
      initialPreferredVariant=""
      initialHasUser={false}
      initialContinueListening={[]}
      continueLoadedOnServer={false}
    />
  );
}
