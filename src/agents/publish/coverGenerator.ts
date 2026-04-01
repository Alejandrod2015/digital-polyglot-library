import { prisma } from "@/lib/prisma";
import { writeClient } from "@/sanity/lib/client";

/**
 * Generate a cover for a published standaloneStory using the internal cover API.
 * Requires the story to already exist in Sanity with a synopsis.
 *
 * Returns { success, coverUrl?, error? }
 */
export async function generateCoverForPublishedStory(params: {
  sanityId: string;
  draftId: string;
}): Promise<{ success: boolean; coverUrl?: string; error?: string }> {
  const { sanityId, draftId } = params;

  try {
    // Load draft data for synopsis, title, metadata
    const draft = await (prisma as any).storyDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) return { success: false, error: `Draft ${draftId} not found` };

    const meta = (draft.metadata ?? {}) as Record<string, any>;
    const synopsis = draft.synopsis || "";
    if (!synopsis.trim()) {
      return { success: false, error: "No synopsis available for cover generation" };
    }

    // Call the cover generation endpoint server-side
    // Build the URL from the current host
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
      || "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/sanity/generate-cover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: sanityId,
        title: draft.title || "",
        synopsis,
        language: meta.language || "",
        region: meta.variant || "",
        topic: meta.journeyTopic || "",
        level: meta.level || "",
        provider: "flux",
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { success: false, error: data?.error || `Cover API returned ${res.status}` };
    }

    const data = await res.json();
    return {
      success: true,
      coverUrl: data.url || undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
