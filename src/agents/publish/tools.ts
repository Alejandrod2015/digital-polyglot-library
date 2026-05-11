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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drafts = await (prisma as any).storyDraft.findMany({
    where: {
      status: "draft",
      latestQaRunId: { not: null },
    },
    take: 50,
  });

  for (const draft of drafts) {
    if (!draft.latestQaRunId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qaReview = await (prisma as any).qAReview.findFirst({
      where: { sourceRunId: draft.latestQaRunId },
    });

    if (!qaReview || qaReview.score < minScore) continue;
    if (qaReview.status !== "pass") continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).storyDraft.update({
      where: { id: draft.id },
      data: { status: "approved" },
    });

    promoted.push(draft.id);
  }

  return promoted;
}

const DEFAULT_VARIANT: Record<string, string> = {
  spanish: "latam",
  english: "us",
  portuguese: "brazil",
  french: "france",
  italian: "italy",
  german: "germany",
};

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
 * Publish an approved StoryDraft as a Studio StandaloneStory.
 * Previously wrote to Sanity; after the Sanity cutover the StandaloneStory
 * Prisma table is the source of truth for the journey. Idempotent: writes
 * by slug-derived id.
 */
export async function publishDraftToSanity(draftId: string): Promise<{
  success: boolean;
  sanityId?: string;
  error?: string;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draft = await (prisma as any).storyDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) return { success: false, error: `Draft ${draftId} not found` };
    if (draft.status !== "approved") {
      return { success: false, error: `Draft ${draftId} is not approved (status: ${draft.status})` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = (draft.metadata ?? {}) as Record<string, any>;
    const language: string = meta.language || "spanish";
    const variant: string = meta.variant || DEFAULT_VARIANT[language] || "latam";
    const region = VARIANT_TO_REGION[variant] ?? null;

    const slug: string = draft.slug || draftId;
    const id = `standalone-${slug}`;

    await prisma.standaloneStory.upsert({
      where: { id },
      create: {
        id,
        slug,
        sourceType: "studio",
        migratedFrom: "story-draft",
        title: draft.title,
        synopsis: draft.synopsis ?? "",
        text: draft.text ?? "",
        vocabRaw: draft.vocab ? JSON.stringify(draft.vocab) : null,
        language,
        variant,
        region,
        cefrLevel: meta.level || "a1",
        focus: "mixed",
        topic: meta.journeyTopic || "",
        journeyEligible: true,
        journeyTopic: meta.journeyTopic || "",
        journeyOrder: meta.storySlot ?? 1,
        journeyFocus: meta.journeyFocus || "General",
        published: true,
      },
      update: {
        title: draft.title,
        synopsis: draft.synopsis ?? "",
        text: draft.text ?? "",
        vocabRaw: draft.vocab ? JSON.stringify(draft.vocab) : null,
        language,
        variant,
        region,
        cefrLevel: meta.level || "a1",
        topic: meta.journeyTopic || "",
        journeyEligible: true,
        journeyTopic: meta.journeyTopic || "",
        journeyOrder: meta.storySlot ?? 1,
        journeyFocus: meta.journeyFocus || "General",
        published: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).storyDraft.update({
      where: { id: draftId },
      data: { status: "published", sourceStoryId: id },
    });

    return { success: true, sanityId: id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
