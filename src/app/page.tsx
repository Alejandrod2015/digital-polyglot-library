// /src/app/page.tsx (server)
import { auth, currentUser } from "@clerk/nextjs/server";
import HomeClient from "./HomeClient";
import JourneyClient from "./journey/JourneyClient";
import { loadJourneyPageProps } from "./journey/journeyPageLoader";
import LandingPage from "@/components/LandingPage";
import { getLatestHomeReleases } from "@/lib/homeReleases";
import { getDailyStories } from "@/lib/dailyJourneyStory";
import { getAvailableLanguageCodes } from "@/lib/languageAvailability";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; tour?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    // Muro 2026-09: el visitante sin cuenta recibe la historia del dia (una
    // por idioma, de journeys vivos) como unica lectura completa.
    const dailyStories = await getDailyStories().catch(() => []);
    return <LandingPage dailyStories={dailyStories} />;
  }

  // Polyglot users: la home ES el Journey (paridad con mobile). En vez
  // de redirect a /journey (que cambia la URL), reusamos el loader y
  // renderizamos JourneyClient directo en /. La URL queda en home y
  // el contenido es la malla del journey. Para los demás planes
  // mantenemos el HomeClient con featured + carruseles.
  //
  // currentUser() puede fallar transitoriamente (ClerkAPIResponseError:
  // rate limit, sesión inválida, network blip). Si falla, caemos al
  // render free para no romper la página entera; el user vuelve a
  // tener el flujo normal en el siguiente request cuando Clerk
  // recupera. Log a stderr para visibilidad.
  let plan: string = "free";
  try {
    const user = await currentUser();
    if (typeof user?.publicMetadata?.plan === "string") {
      plan = user.publicMetadata.plan;
    }
  } catch (err) {
    console.error("[home] currentUser() failed, falling back to free:", err);
  }

  // `?tour=preview` en desarrollo: el tour de producto vive en HomeClient,
  // asi que un polyglot (cuya home ES el journey) no puede verlo nunca. Este
  // desvio solo existe fuera de produccion y solo para previsualizarlo.
  const { variant, tour } = await searchParams;
  const tourPreview = tour === "preview" && process.env.NODE_ENV !== "production";

  if (plan === "polyglot" && !tourPreview) {
    const props = await loadJourneyPageProps({ variant, basePath: "/" });
    return <JourneyClient {...props} />;
  }

  // El heroe sale de la historia del dia de los journeys, no de la destacada
  // del catalogo congelado de libros. Aquella salia de un hash sobre
  // src/data/books, que solo tiene espanol e italiano, y su clave de semana
  // saltaba con el dia: el sabado 2026-09-05 mandaba a todo el mundo, pidiera
  // el idioma que pidiera, a una historia italiana de nivel intermedio. Ademas
  // es la unica que canAccessStoryContent abre de verdad a free y basic, asi
  // que la etiqueta "Free today" del heroe pasa a ser cierta.
  const [{ latestBooks, latestStories, latestPolyglotStories }, dailyStories, availableLanguages] =
    await Promise.all([
      getLatestHomeReleases({ limit: 10 }),
      getDailyStories().catch(() => []),
      // Mismo dato que la app pinta como "Coming soon" en su onboarding.
      getAvailableLanguageCodes().catch(() => []),
    ]);

  return (
    <HomeClient
      latestBooks={latestBooks}
      latestStories={latestStories}
      latestPolyglotStories={latestPolyglotStories}
      dailyStories={dailyStories}
      availableLanguages={availableLanguages}
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
