import { listStudioJourneyStories, type StudioJourneyStory } from "@/lib/studioJourneyStories";
import { prisma } from "@/lib/prisma";
import { getJourneyCurriculumPlans, saveJourneyVariantPlanForStudio } from "@/lib/journeyCurriculumSource";
import { loadPlannerConfig } from "@/agents/config/plannerConfig";
import type { PlannerGap, JourneyProposal } from "./types";

// Load all journey stories from Sanity
export async function loadCatalog(): Promise<StudioJourneyStory[]> {
  return listStudioJourneyStories();
}

// Extract unique journey topics from the catalog
export function extractTopics(stories: StudioJourneyStory[]): string[] {
  const topics = new Set<string>();
  for (const story of stories) {
    if (story.journeyTopic?.trim()) topics.add(story.journeyTopic.trim());
  }
  return Array.from(topics).sort();
}

// Detect gaps by comparing catalog against expected grid
export async function detectGaps(
  stories: StudioJourneyStory[],
  scope: { language?: string; variant?: string; journeyTopic?: string }
): Promise<PlannerGap[]> {
  const gaps: PlannerGap[] = [];
  const plannerConfig = await loadPlannerConfig();

  // Load curriculum plans to understand the expected structure
  const curriculumPlans = await getJourneyCurriculumPlans();

  // Build a set of existing stories keyed by language+variant+level+topic+slot
  const existingKeys = new Set<string>();
  for (const story of stories) {
    if (!story.journeyEligible) continue;
    const key = `${story.language}|${story.variant}|${story.cefrLevel}|${story.journeyTopic}|${story.journeyOrder ?? 1}`;
    existingKeys.add(key);
  }

  // Get topics from existing stories and curriculum
  const topics = extractTopics(stories);
  if (topics.length === 0) return gaps;

  // Filter curriculum plans based on scope
  let plansToCheck = curriculumPlans;
  if (scope.language) {
    plansToCheck = plansToCheck.filter((p) => p.language.toLowerCase() === scope.language?.toLowerCase());
  }
  if (scope.variant) {
    plansToCheck = plansToCheck.filter((p) => p.variantId.toLowerCase() === scope.variant?.toLowerCase());
  }

  let topicsToCheck = topics;
  if (scope.journeyTopic) {
    topicsToCheck = topics.filter((t) => t.toLowerCase() === scope.journeyTopic?.toLowerCase());
  }

  for (const plan of plansToCheck) {
    for (const level of plan.levels) {
      for (const topic of topicsToCheck) {
        // Match topic against curriculum topics (case-insensitive)
        const matchedTopic = level.topics.find((t) => t.slug.toLowerCase() === topic.toLowerCase());
        if (!matchedTopic) continue;

        // Determine how many slots to check for this topic
        const slotTarget = matchedTopic.storyTarget || plannerConfig.expectedSlotsPerTopic;

        for (let slot = 1; slot <= slotTarget; slot++) {
          const key = `${plan.language}|${plan.variantId}|${level.id}|${topic}|${slot}`;
          if (!existingKeys.has(key)) {
            // Check if there's a story that's close but incomplete
            const incomplete = stories.find(
              (s) =>
                s.language.toLowerCase() === plan.language.toLowerCase() &&
                s.variant.toLowerCase() === plan.variantId.toLowerCase() &&
                s.cefrLevel.toLowerCase() === level.id.toLowerCase() &&
                s.journeyTopic.toLowerCase() === topic.toLowerCase() &&
                (s.journeyOrder ?? 1) === slot &&
                (!s.text.trim() || !s.audioUrl.trim())
            );

            gaps.push({
              language: plan.language,
              variant: plan.variantId,
              level: level.id,
              journeyTopic: topic,
              storySlot: slot,
              journeyFocus: "General",
              reason: incomplete ? "incomplete" : "missing",
            });
          }
        }
      }
    }
  }

  return gaps;
}

// Generate a brief title for a gap
export function generateBriefTitle(gap: PlannerGap): string {
  return `${gap.journeyTopic} – ${gap.level.toUpperCase()} – Slot ${gap.storySlot} (${gap.language} ${gap.variant})`;
}

// Save briefs to database
export async function saveBriefs(gaps: PlannerGap[], sourceRunId: string): Promise<number> {
  let created = 0;
  for (const gap of gaps) {
    // Check if brief already exists for this slot
    const existing = await (prisma as any).curriculumBrief.findFirst({
      where: {
        language: gap.language,
        variant: gap.variant,
        level: gap.level,
        topicSlug: gap.journeyTopic,
        storySlot: gap.storySlot,
      },
    });
    if (existing) continue;

    const title = generateBriefTitle(gap);
    await (prisma as any).curriculumBrief.create({
      data: {
        language: gap.language,
        variant: gap.variant,
        level: gap.level,
        journeyKey: `${gap.language}-${gap.variant}-${gap.level}`,
        topicSlug: gap.journeyTopic,
        storySlot: gap.storySlot,
        journeyFocus: gap.journeyFocus,
        title,
        brief: {
          description: `Historia para el journey "${gap.journeyTopic}", slot ${gap.storySlot}. Nivel ${gap.level.toUpperCase()}, ${gap.language} (${gap.variant}).`,
          reason: gap.reason,
          constraints: {
            language: gap.language,
            variant: gap.variant,
            level: gap.level,
            topic: gap.journeyTopic,
            focus: gap.journeyFocus,
          },
        },
        status: "draft",
        sourceRunId,
      },
    });
    created++;
  }
  return created;
}

// ── New journey-creation functions ──

export async function proposeJourneys(params: {
  topic: string;
  topicLabel: string;
  targetLanguages: string[];
  targetLevels: string[];
  storiesPerLevel: number;
}): Promise<JourneyProposal[]> {
  const existingPlans = await getJourneyCurriculumPlans();
  const proposals: JourneyProposal[] = [];

  for (const lang of params.targetLanguages) {
    // Find existing variant plans for this language
    const langPlans = existingPlans.filter(
      (p) => p.language.toLowerCase() === lang.toLowerCase()
    );

    // Use first variant or default
    const variantId = langPlans[0]?.variantId ?? lang.toLowerCase();

    // Check if topic already exists in any level for this language
    const existingPlan = langPlans.find((p) =>
      p.levels.some((l) =>
        l.topics.some((t) => t.slug.toLowerCase() === params.topic.toLowerCase())
      )
    );

    if (existingPlan) continue; // Skip — topic already exists for this language

    proposals.push({
      language: lang,
      variant: variantId,
      topic: params.topic,
      topicLabel: params.topicLabel,
      levels: params.targetLevels,
      storiesPerLevel: params.storiesPerLevel,
      rationale: `Nuevo topic "${params.topicLabel}" para ${lang} (${variantId}). Niveles: ${params.targetLevels.map((l) => l.toUpperCase()).join(", ")}. ${params.storiesPerLevel} historias por nivel.`,
    });
  }

  return proposals;
}

export async function createJourneys(proposals: JourneyProposal[]): Promise<number> {
  let created = 0;
  const existingPlans = await getJourneyCurriculumPlans();

  for (const proposal of proposals) {
    // Find existing variant plan or create a new one
    let variantPlan = existingPlans.find(
      (p) =>
        p.language.toLowerCase() === proposal.language.toLowerCase() &&
        p.variantId.toLowerCase() === proposal.variant.toLowerCase()
    );

    if (!variantPlan) {
      variantPlan = {
        language: proposal.language,
        variantId: proposal.variant,
        levels: [],
      };
    }

    // Deep clone to avoid mutating cache
    const updatedPlan = JSON.parse(JSON.stringify(variantPlan));

    // Add topic to each target level
    for (const levelId of proposal.levels) {
      let level = updatedPlan.levels.find((l: any) => l.id === levelId);
      if (!level) {
        level = {
          id: levelId,
          title: levelId.toUpperCase(),
          subtitle: `Nivel ${levelId.toUpperCase()}`,
          topicTarget: 0,
          storyTargetPerTopic: proposal.storiesPerLevel,
          topics: [],
        };
        updatedPlan.levels.push(level);
      }

      // Check if topic already exists in this level
      const topicExists = level.topics.some(
        (t: any) => t.slug.toLowerCase() === proposal.topic.toLowerCase()
      );
      if (topicExists) continue;

      level.topics.push({
        slug: proposal.topic,
        label: proposal.topicLabel,
        storyTarget: proposal.storiesPerLevel,
        checkpoint: "mixed",
      });
      level.topicTarget = level.topics.length;
    }

    await saveJourneyVariantPlanForStudio(updatedPlan);
    created++;
  }

  return created;
}
