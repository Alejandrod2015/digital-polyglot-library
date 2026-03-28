import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { getQAReviewsForStory } from "@/lib/agentPersistence";

export async function GET(request: Request) {
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
    const url = new URL(request.url);
    const storyId = url.searchParams.get("storyId");

    if (!storyId) {
      return NextResponse.json(
        { error: "Missing required query parameter 'storyId'" },
        { status: 400 }
      );
    }

    const reviews = await getQAReviewsForStory(storyId);
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("[api/agents/qa/reviews] failed", error);
    return NextResponse.json({ error: "Failed to fetch QA reviews" }, { status: 500 });
  }
}
