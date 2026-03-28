import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { autoPromoteDrafts, publishDraftToSanity } from "@/agents/publish/tools";

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

  try {
    const body = await request.json().catch(() => ({}));
    const minScore = body.minScore ?? 90;
    const autoPublish = body.autoPublish === true;

    // Step 1: Auto-promote
    const promoted = await autoPromoteDrafts({ minScore });

    // Step 2: Optionally publish promoted drafts
    const published: Array<{ draftId: string; sanityId?: string; error?: string }> = [];
    if (autoPublish) {
      for (const draftId of promoted) {
        const result = await publishDraftToSanity(draftId);
        published.push({
          draftId,
          sanityId: result.sanityId,
          error: result.error,
        });
      }
    }

    return NextResponse.json({
      promoted: promoted.length,
      promotedIds: promoted,
      published: published.filter((p) => p.sanityId).length,
      publishResults: published,
    });
  } catch (error) {
    console.error("[api/agents/drafts/promote] failed", error);
    return NextResponse.json(
      { error: "Failed to promote/publish drafts" },
      { status: 500 }
    );
  }
}
