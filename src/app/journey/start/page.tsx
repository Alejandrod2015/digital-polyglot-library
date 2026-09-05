import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buildJourneyVariants } from "../journeyData";
import { normalizeVariant } from "@/lib/languageVariant";
import { getJourneyVariantFromPreferences } from "@/lib/onboarding";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import { books } from "@/data/books";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A donde cae quien acaba de terminar el onboarding en la web.
 *
 * Antes iba a la "historia destacada de la semana", que sale de un hash sobre
 * el catalogo entero de `src/data/books` y no mira ni el idioma ni el nivel de
 * nadie. El catalogo solo tiene espanol e italiano, asi que en la semana del
 * 2026-09-05 todo el mundo, hubiera pedido lo que hubiera pedido, aterrizaba
 * en una historia italiana de nivel intermedio, y quien aprende aleman o
 * portugues no acertaba ninguna semana.
 *
 * Esta ruta no pinta nada: decide y redirige. Primero la primera historia de
 * su journey; si su idioma todavia no tiene journey publicado, la destacada,
 * que es el comportamiento viejo y sigue siendo mejor que la home vacia.
 */
export default async function JourneyStartPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  const targetLanguagesRaw = user?.publicMetadata?.targetLanguages;
  const targetLanguage = Array.isArray(targetLanguagesRaw)
    ? targetLanguagesRaw.find(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    : undefined;

  const tracks = await buildJourneyVariants(targetLanguage);

  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const preferredRegion =
    typeof user?.publicMetadata?.preferredRegion === "string"
      ? user.publicMetadata.preferredRegion
      : null;
  const fallbackVariant = targetLanguage
    ? getJourneyVariantFromPreferences(targetLanguage, preferredVariant, preferredRegion) ?? null
    : null;

  // Mismo orden de preferencia que usa /journey al resolver ?variant=, para
  // que la primera pantalla y la malla hablen del mismo journey.
  const track =
    [preferredVariant, fallbackVariant]
      .map((candidate) =>
        candidate
          ? tracks.find(
              (t) => t.id === candidate || t.slug === candidate || t.variant === candidate
            ) ?? null
          : null
      )
      .find((t): t is NonNullable<typeof t> => Boolean(t)) ??
    tracks[0] ??
    null;

  // Los journeys vivos son de un solo nivel (1x7x3), asi que "el primero" es
  // el suyo. Si algun dia vuelve uno de varios niveles, el primer nivel sigue
  // siendo lo que la malla ensena arriba del todo.
  const firstStory = track?.levels
    .flatMap((level) => level.topics)
    .flatMap((topic) => topic.stories)
    .find((story) => Boolean(story.href));

  if (firstStory) {
    const separator = firstStory.href.includes("?") ? "&" : "?";
    redirect(`${firstStory.href}${separator}welcome=onboarding`);
  }

  // Sin journey publicado en su idioma (frances, polaco, coreano, arabe a dia
  // de hoy). La destacada no sera de su idioma, pero es lo unico reproducible
  // que hay, y el aviso de que su journey aun no existe vive en la home.
  const featured = await getFeaturedStories();
  const weeklySlug = featured.week?.slug ?? null;
  if (weeklySlug) {
    for (const book of Object.values(books)) {
      if (book.stories.some((story) => story.slug === weeklySlug)) {
        redirect(`/books/${book.slug}/${weeklySlug}?welcome=onboarding`);
      }
    }
  }

  redirect("/");
}
