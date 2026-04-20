import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import JourneyClient from "./JourneyClient";
import { buildJourneyTrackInsights, buildJourneyVariants } from "./journeyData";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import { normalizeVariant } from "@/lib/languageVariant";
import { getJourneyFocusFromLearningGoal, getJourneyVariantFromPreferences, normalizeJourneyFocus } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Journey | Digital Polyglot",
  description: "Move through language by level and topic, one journey at a time.",
};

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  const user = await currentUser();
  const journeyFocus =
    typeof user?.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user?.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null
        );
  const targetLanguagesRaw = user?.publicMetadata?.targetLanguages;
  const targetLanguage =
    Array.isArray(targetLanguagesRaw) && typeof targetLanguagesRaw[0] === "string"
      ? targetLanguagesRaw[0]
      : "Spanish";
  const tracks = await buildJourneyVariants(targetLanguage, journeyFocus ?? "General");
  const preferredRegion =
    typeof user?.publicMetadata?.preferredRegion === "string"
      ? user.publicMetadata.preferredRegion
      : null;
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const fallbackVariant =
    getJourneyVariantFromPreferences(targetLanguage, preferredVariant, preferredRegion) ?? null;
  const initialVariantId =
    (typeof variant === "string" ? normalizeVariant(variant) : null) ??
    ([preferredVariant, fallbackVariant].find((candidate) => candidate && tracks.some((track) => track.id === candidate)) ?? null) ??
    tracks[0]?.id ??
    "";
  if (!variant && initialVariantId) {
    redirect(`/journey?variant=${encodeURIComponent(initialVariantId)}`);
  }
  const [completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] = await Promise.all([
    getCompletedJourneyStoryKeys(),
    getPassedJourneyCheckpointKeys(),
    getPracticedJourneyTopicKeys(),
    getJourneyDueReviewItems(),
  ]);
  const initialTrack = tracks.find((track) => track.id === initialVariantId) ?? tracks[0] ?? null;
  return (
    <JourneyClient
      tracks={tracks}
      initialVariantId={initialVariantId}
      preferredLevel={typeof user?.publicMetadata?.preferredLevel === "string" ? user.publicMetadata.preferredLevel : null}
      learningGoal={typeof user?.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null}
      journeyFocus={journeyFocus ?? "General"}
      dailyMinutes={typeof user?.publicMetadata?.dailyMinutes === "number" ? user.publicMetadata.dailyMinutes : null}
      journeyPlacementLevel={
        typeof user?.publicMetadata?.journeyPlacementLevel === "string"
          ? user.publicMetadata.journeyPlacementLevel
          : null
      }
      initialInsights={
        initialTrack
          ? buildJourneyTrackInsights(
              initialTrack,
              completedStoryKeys,
              practicedTopicKeys,
              passedCheckpointKeys,
              dueReviewItems
            )
          : null
      }
      completedStoryKeys={[...completedStoryKeys]}
      passedCheckpointKeys={[...passedCheckpointKeys]}
      practicedTopicKeys={[...practicedTopicKeys]}
      dueReviewItems={dueReviewItems}
    />
  );
}
