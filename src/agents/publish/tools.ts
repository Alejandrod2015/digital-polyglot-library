import { prisma } from "@/lib/prisma";

/**
 * Auto-promote drafts that pass QA with a high score.
 * Returns the IDs of promoted drafts.
 */
export async function autoPromoteDrafts(params: {
  minScore?: number;
}): Promise<string[]> {
  const minScore = params.minScore ?? 85;
  const promoted: string[] = [];

  // Find drafts that have a QA review with score >= minScore and are still in "draft" status
  const drafts = await (prisma as any).storyDraft.findMany({
    where: {
      status: "draft",
      latestQaRunId: { not: null },
    },
    take: 50,
  });

  for (const draft of drafts) {
    if (!draft.latestQaRunId) continue;

    // Look up the QA review for this run
    const qaReview = await (prisma as any).qAReview.findFirst({
      where: { sourceRunId: draft.latestQaRunId },
    });

    if (!qaReview || qaReview.score < minScore) continue;
    if (qaReview.status !== "pass") continue;

    // Promote the draft
    await (prisma as any).storyDraft.update({
      where: { id: draft.id },
      data: { status: "approved" },
    });

    promoted.push(draft.id);
  }

  return promoted;
}

/**
 * Language → default variant mapping.
 * Used when the brief doesn't specify a variant.
 */
const DEFAULT_VARIANT: Record<string, string> = {
  spanish: "latam",
  english: "us",
  portuguese: "brazil",
  french: "france",
  italian: "italy",
  german: "germany",
};

/**
 * Language → region field name in the standaloneStory schema.
 */
const REGION_FIELD: Record<string, string> = {
  spanish: "region_es",
  english: "region_en",
  portuguese: "region_pt",
  french: "region_fr",
  italian: "region_it",
  german: "region_de",
};

/**
 * Variant → region value mapping.
 */
const VARIANT_TO_REGION: Record<string, string> = {
  latam: "colombia",
  spain: "spain",
  us: "usa",
  uk: "uk",
  brazil: "brazil",
  portugal: "portugal",
  france: "france",
  "canada-fr": "france",
  italy: "italy",
  germany: "germany",
  austria: "germany",
};

/**
 * Publish an approved draft to Sanity CMS as a standaloneStory.
 * Creates or updates the document so it appears in the journey.
 */
export async function publishDraftToSanity(draftId: string): Promise<{
  success: boolean;
  sanityId?: string;
  error?: string;
}> {
  try {
    const draft = await (prisma as any).storyDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) return { success: false, error: `Draft ${draftId} not found` };
    if (draft.status !== "approved") {
      return { success: false, error: `Draft ${draftId} is not approved (status: ${draft.status})` };
    }

    const meta = (draft.metadata ?? {}) as Record<string, any>;
    const { writeClient } = await import("@/sanity/lib/client");

    const language: string = meta.language || "spanish";
    const variant: string = meta.variant || DEFAULT_VARIANT[language] || "latam";
    const regionField = REGION_FIELD[language];
    const regionValue = VARIANT_TO_REGION[variant];

    // Build Sanity standaloneStory document
    const sanityId = `standalone-${draft.slug || draftId}`;
    const doc: Record<string, unknown> = {
      _id: sanityId,
      _type: "standaloneStory",

      // Core content
      title: draft.title,
      slug: { _type: "slug", current: draft.slug },
      text: draft.text,
      synopsis: draft.synopsis || "",
      vocabRaw: draft.vocab ? JSON.stringify(draft.vocab) : "[]",

      // Classification
      language,
      variant,
      cefrLevel: meta.level || "a1",
      focus: "mixed",
      topic: meta.journeyTopic || "",

      // Journey fields — these make the story visible in the journey
      journeyEligible: true,
      journeyTopic: meta.journeyTopic || "",
      journeyOrder: meta.storySlot ?? 1,
      journeyFocus: meta.journeyFocus || "General",

      // Source tracking
      sourceType: "sanity",

      // Published so it shows up in queries
      published: true,
    };

    // Set the correct region field for this language
    if (regionField && regionValue) {
      doc[regionField] = regionValue;
    }

    await writeClient.createOrReplace(doc as any);

    // Update draft status to published
    await (prisma as any).storyDraft.update({
      where: { id: draftId },
      data: { status: "published", sourceStoryId: sanityId },
    });

    return { success: true, sanityId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
