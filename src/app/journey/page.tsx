import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import JourneyClient from "./JourneyClient";
import { buildJourneyVariants } from "./journeyData";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import { normalizeVariant } from "@/lib/languageVariant";

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
  const tracks = await buildJourneyVariants();
  const user = await currentUser();
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const initialVariantId =
    (typeof variant === "string" ? normalizeVariant(variant) : null) ??
    (preferredVariant && tracks.some((track) => track.id === preferredVariant) ? preferredVariant : null) ??
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
  return (
    <JourneyClient
      tracks={tracks}
      initialVariantId={initialVariantId}
      completedStoryKeys={[...completedStoryKeys]}
      passedCheckpointKeys={[...passedCheckpointKeys]}
      practicedTopicKeys={[...practicedTopicKeys]}
      dueReviewItems={dueReviewItems}
    />
  );
}
