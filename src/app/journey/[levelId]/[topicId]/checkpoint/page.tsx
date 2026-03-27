import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  buildJourneyLevels,
  buildJourneyTopicPracticeItems,
  isJourneyTopicComplete,
} from "@/app/journey/journeyData";
import { getCompletedJourneyStoryKeys } from "@/lib/journeyProgress";
import { normalizeVariant } from "@/lib/languageVariant";
import { getJourneyFocusFromLearningGoal, getJourneyVariantFromPreferences, normalizeJourneyFocus } from "@/lib/onboarding";

export default async function JourneyCheckpointPage({
  params,
  searchParams,
}: {
  params: Promise<{ levelId: string; topicId: string }>;
  searchParams: Promise<{ variant?: string; returnTo?: string }>;
}) {
  const { levelId, topicId } = await params;
  const { variant, returnTo } = await searchParams;
  const user = await currentUser();
  const preferredRegion =
    typeof user?.publicMetadata?.preferredRegion === "string"
      ? user.publicMetadata.preferredRegion
      : null;
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const journeyFocus =
    typeof user?.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user?.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null
        );
  const variantId =
    (typeof variant === "string" && variant.trim() !== "" ? normalizeVariant(variant) : null) ??
    preferredVariant ??
    getJourneyVariantFromPreferences("Spanish", preferredVariant, preferredRegion) ??
    undefined;
  if (!variant && variantId) {
    redirect(`/journey/${levelId}/${topicId}/checkpoint?variant=${encodeURIComponent(variantId)}`);
  }
  const checkpoint = await buildJourneyTopicPracticeItems(variantId, levelId, topicId, journeyFocus ?? "General");
  const completedStoryKeys = await getCompletedJourneyStoryKeys();

  if (!checkpoint) {
    redirect("/journey");
  }
  const level = (await buildJourneyLevels(variantId, "Spanish", journeyFocus ?? "General")).find((entry) => entry.id === levelId) ?? null;
  const topic = level?.topics.find((entry) => entry.slug === topicId) ?? null;
  if (!topic || !isJourneyTopicComplete(topic, completedStoryKeys)) {
    redirect(variantId ? `/journey/${levelId}/${topicId}?variant=${encodeURIComponent(variantId)}` : `/journey/${levelId}/${topicId}`);
  }

  const redirectParams = new URLSearchParams({
    source: "journey",
    levelId,
    topicId,
    checkpoint: "1",
  });

  if (variantId) {
    redirectParams.set("variant", variantId);
  }
  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    redirectParams.set("returnTo", returnTo);
  }

  redirect(`/practice?${redirectParams.toString()}`);
}
