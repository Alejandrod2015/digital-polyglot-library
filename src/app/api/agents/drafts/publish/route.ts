import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { publishDraftToSanity } from "@/agents/publish/tools";

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
    const body = await request.json();
    const draftId = body.draftId;

    if (!draftId) {
      return NextResponse.json(
        { error: "Missing 'draftId' parameter" },
        { status: 400 }
      );
    }

    const result = await publishDraftToSanity(draftId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      draftId,
      sanityId: result.sanityId,
    });
  } catch (error) {
    console.error("[api/agents/drafts/publish] failed", error);
    return NextResponse.json(
      { error: "Failed to publish draft" },
      { status: 500 }
    );
  }
}
