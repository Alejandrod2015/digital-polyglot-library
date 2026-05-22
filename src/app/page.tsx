// /src/app/page.tsx (server)
import { auth, currentUser } from "@clerk/nextjs/server";
import HomeClient from "./HomeClient";
import JourneyClient from "./journey/JourneyClient";
import { loadJourneyPageProps } from "./journey/journeyPageLoader";
import LandingPage from "@/components/LandingPage";
import { getLatestHomeReleases } from "@/lib/homeReleases";
import { getFeaturedStories } from "@/lib/getFeaturedStory";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  // Polyglot users: la home ES el Journey (paridad con mobile). En vez
  // de redirect a /journey (que cambia la URL), reusamos el loader y
  // renderizamos JourneyClient directo en /. La URL queda en home y
  // el contenido es la malla del journey. Para los demás planes
  // mantenemos el HomeClient con featured + carruseles.
  const user = await currentUser();
  const plan =
    typeof user?.publicMetadata?.plan === "string"
      ? user.publicMetadata.plan
      : "free";

  if (plan === "polyglot") {
    const { variant } = await searchParams;
    const props = await loadJourneyPageProps({ variant, basePath: "/" });
    return <JourneyClient {...props} />;
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
