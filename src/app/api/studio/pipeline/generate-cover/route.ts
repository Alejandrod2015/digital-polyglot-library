import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { generateCoverForPublishedStory } from "@/agents/publish/coverGenerator";

/** Vercel Hobby allows up to 60s — Flux polling can take up to 90s but usually ~30s */
export const maxDuration = 60;

/**
 * POST /api/studio/pipeline/generate-cover
 *
 * Generates a cover for a single published story.
 * Called by the PipelineRunner UI in sequence after stories are published.
 *
 * Body: { sanityId: string, draftId: string }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { sanityId, draftId } = body;
  if (!sanityId || !draftId) {
    return NextResponse.json({ error: "sanityId and draftId are required" }, { status: 400 });
  }

  try {
    const result = await generateCoverForPublishedStory({ sanityId, draftId });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
