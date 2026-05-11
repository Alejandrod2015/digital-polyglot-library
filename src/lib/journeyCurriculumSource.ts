// /src/lib/journeyCurriculumSource.ts
//
// Source of journey curriculum plans. Previously read from Sanity
// `journeyVariantPlan` docs; after the Sanity -> Studio cutover the
// hardcoded fallback is the only source. If the project needs an editable
// curriculum again, add a Prisma model and migrate this module to read
// from it. Until then, edit the curriculum in code.

import {
  JOURNEY_CURRICULUM as FALLBACK_CURRICULUM,
  type JourneyLevelPlan,
  type JourneyVariantPlan,
} from "@/app/journey/journeyCurriculum";

export async function getJourneyCurriculumPlans(): Promise<JourneyVariantPlan[]> {
  return FALLBACK_CURRICULUM;
}

export async function getJourneyVariantPlanAsync(
  language: string,
  variantId: string
): Promise<JourneyVariantPlan | null> {
  const plans = await getJourneyCurriculumPlans();
  const normalizedLanguage = language.trim().toLowerCase();
  const normalizedVariant = variantId.trim().toLowerCase();
  return (
    plans.find(
      (plan) =>
        plan.language.trim().toLowerCase() === normalizedLanguage &&
        plan.variantId.trim().toLowerCase() === normalizedVariant
    ) ?? null
  );
}

export async function getJourneyLevelPlanAsync(
  language: string,
  variantId: string,
  levelId: string
): Promise<JourneyLevelPlan | null> {
  const variant = await getJourneyVariantPlanAsync(language, variantId);
  if (!variant) return null;
  return variant.levels.find((level) => level.id === levelId) ?? null;
}

export async function listJourneyVariantPlansForStudio(): Promise<JourneyVariantPlan[]> {
  return FALLBACK_CURRICULUM;
}

export async function getJourneyVariantPlanForStudio(
  language: string,
  variantId: string,
  journeyType?: string
): Promise<JourneyVariantPlan | null> {
  const plans = await listJourneyVariantPlansForStudio();
  const normalizedJourneyType = (journeyType ?? "generico").trim().toLowerCase();
  return (
    plans.find(
      (plan) =>
        plan.language.trim().toLowerCase() === language.trim().toLowerCase() &&
        plan.variantId.trim().toLowerCase() === variantId.trim().toLowerCase() &&
        (plan.journeyType ?? "generico").trim().toLowerCase() === normalizedJourneyType
    ) ?? null
  );
}

// Writes are not supported after the Sanity cutover. Kept as a no-op so
// existing Studio components do not throw on submit; persistence requires
// editing src/app/journey/journeyCurriculum.ts in code.
export async function saveJourneyVariantPlanForStudio(
  _plan: JourneyVariantPlan
): Promise<void> {
  console.warn(
    "[journeyCurriculumSource] saveJourneyVariantPlanForStudio is a no-op after the Sanity cutover. Edit src/app/journey/journeyCurriculum.ts in code."
  );
}
