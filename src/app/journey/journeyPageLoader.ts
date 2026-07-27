// Server-side loader compartido por la ruta /journey y por la home /
// cuando el plan es Polyglot. Ambos puntos de entrada renderizan el
// mismo JourneyClient con los mismos props; sin este helper habría
// que duplicar toda la lógica de fetch + reconciliación + redirect.
//
// `basePath` controla el redirect interno cuando falta ?variant= en la
// URL: para /journey redirige a /journey?variant=X, para / (polyglot
// home) redirige a /?variant=X. La URL externa queda consistente con
// el punto de entrada original.

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buildJourneyVariants } from "./journeyData";
import { buildJourneyTrackInsights } from "./journeyInsights";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import { normalizeVariant } from "@/lib/languageVariant";
import {
  getJourneyFocusFromLearningGoal,
  getJourneyVariantFromPreferences,
  normalizeJourneyFocus,
} from "@/lib/onboarding";
import type { ComponentProps } from "react";
import type JourneyClient from "./JourneyClient";

export type JourneyClientProps = ComponentProps<typeof JourneyClient>;

export async function loadJourneyPageProps({
  variant,
  basePath,
}: {
  variant: string | undefined;
  basePath: "/" | "/journey";
}): Promise<JourneyClientProps> {
  const user = await currentUser();
  const journeyFocus =
    typeof user?.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user?.publicMetadata?.learningGoal === "string"
            ? user.publicMetadata.learningGoal
            : null
        );
  const targetLanguagesRaw = user?.publicMetadata?.targetLanguages;
  const hasTargets =
    Array.isArray(targetLanguagesRaw) &&
    targetLanguagesRaw.some((v) => typeof v === "string" && v.trim().length > 0);
  // "No preference" = user dejó targetLanguages vacío en settings.
  // En ese caso pasamos `undefined` para que el helper traiga
  // journeys de TODOS los idiomas disponibles y el sheet "Switch
  // journey" liste todo. Con targets específicos, primer language.
  const targetLanguage = hasTargets
    ? (targetLanguagesRaw as string[]).find(
        (v): v is string => typeof v === "string" && v.trim().length > 0
      ) ?? undefined
    : undefined;
  let tracks = await buildJourneyVariants(targetLanguage, journeyFocus ?? "General");
  const preferredRegion =
    typeof user?.publicMetadata?.preferredRegion === "string"
      ? user.publicMetadata.preferredRegion
      : null;
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  // Si el usuario está en "No preference", no hay un fallback de
  // variant válido; todos los journeys son candidatos legítimos.
  const fallbackVariant = targetLanguage
    ? getJourneyVariantFromPreferences(targetLanguage, preferredVariant, preferredRegion) ?? null
    : null;

  // Variant param resolver: el URL puede traer slug ("viajero-latam"),
  // CUID legacy ("cmovi4cvi..."), o el variant code ("latam"). En
  // todos los casos resolvemos al track real y, si la URL llegó por
  // un identificador feo, hacemos redirect al slug clean para que
  // bookmarks y shares queden limpios.
  const incomingVariant =
    typeof variant === "string" && variant.length > 0 ? variant : null;
  const resolveIn = (pool: typeof tracks) =>
    pool.find((t) => t.slug === incomingVariant) ??
    pool.find((t) => t.id === incomingVariant) ??
    pool.find(
      (t) =>
        t.variant === normalizeVariant(incomingVariant) ||
        t.variant === (incomingVariant ?? "").toLowerCase()
    ) ??
    null;
  let resolvedTrack = null;
  if (incomingVariant) {
    resolvedTrack = resolveIn(tracks);
    // Cross-language SHARE link: the slug belongs to a journey of a different
    // language than the viewer's target, so it isn't in `tracks`. Rebuild the
    // full catalog once, resolve there, and switch `tracks` to that journey's
    // language so the page renders it (and the switch sheet lists its siblings).
    // Only paid on the miss, so the common same-language path stays cheap.
    if (!resolvedTrack) {
      const allTracks = await buildJourneyVariants(undefined, journeyFocus ?? "General");
      const matched = resolveIn(allTracks);
      if (matched) {
        const lang = (matched.language ?? "").toLowerCase();
        tracks = lang
          ? allTracks.filter((t) => (t.language ?? "").toLowerCase() === lang)
          : allTracks;
        resolvedTrack = tracks.find((t) => t.id === matched.id) ?? matched;
      }
    }
    if (resolvedTrack && resolvedTrack.slug !== incomingVariant) {
      redirect(`${basePath}?variant=${encodeURIComponent(resolvedTrack.slug)}`);
    }
  }

  // Si no hay variant en URL, elegimos un default y redirigimos a la
  // URL con el slug, para que el state quede explícito.
  if (!resolvedTrack) {
    const preferredTrackBySlugOrId = [preferredVariant, fallbackVariant]
      .map((candidate) =>
        candidate
          ? tracks.find(
              (t) =>
                t.id === candidate ||
                t.slug === candidate ||
                t.variant === candidate
            ) ?? null
          : null
      )
      .find((t): t is NonNullable<typeof t> => Boolean(t)) ?? null;
    resolvedTrack = preferredTrackBySlugOrId ?? tracks[0] ?? null;
    if (!incomingVariant && resolvedTrack) {
      redirect(`${basePath}?variant=${encodeURIComponent(resolvedTrack.slug)}`);
    }
  }

  const initialVariantId = resolvedTrack?.id ?? "";

  const [completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] =
    await Promise.all([
      getCompletedJourneyStoryKeys(),
      getPassedJourneyCheckpointKeys(),
      getPracticedJourneyTopicKeys(),
      getJourneyDueReviewItems(),
    ]);

  const initialTrack = tracks.find((track) => track.id === initialVariantId) ?? tracks[0] ?? null;

  return {
    tracks,
    initialVariantId,
    // The user's chosen target languages (Clerk publicMetadata). Passed so
    // the "+ Add journey" picker can prepend a newly-picked language and
    // POST the merged list back without a round-trip to read it first.
    targetLanguages: hasTargets
      ? (targetLanguagesRaw as string[]).filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0
        )
      : [],
    preferredLevel:
      typeof user?.publicMetadata?.preferredLevel === "string"
        ? user.publicMetadata.preferredLevel
        : null,
    learningGoal:
      typeof user?.publicMetadata?.learningGoal === "string"
        ? user.publicMetadata.learningGoal
        : null,
    journeyFocus: journeyFocus ?? "General",
    dailyMinutes:
      typeof user?.publicMetadata?.dailyMinutes === "number"
        ? user.publicMetadata.dailyMinutes
        : null,
    journeyPlacementLevel:
      typeof user?.publicMetadata?.journeyPlacementLevel === "string"
        ? user.publicMetadata.journeyPlacementLevel
        : null,
    initialInsights: initialTrack
      ? buildJourneyTrackInsights(
          initialTrack,
          completedStoryKeys,
          practicedTopicKeys,
          passedCheckpointKeys,
          dueReviewItems
        )
      : null,
    completedStoryKeys: [...completedStoryKeys],
    passedCheckpointKeys: [...passedCheckpointKeys],
    practicedTopicKeys: [...practicedTopicKeys],
    dueReviewItems,
  };
}
