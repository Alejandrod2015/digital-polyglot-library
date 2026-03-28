import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { runJourneyStoryQaAgent } from "@/agents/qa/agent";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
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
    const { storyId } = await context.params;
    const run = await runJourneyStoryQaAgent(storyId);
    return NextResponse.json(run);
  } catch (error) {
    console.error("[api/agents/qa/journey-story/:storyId] failed", error);
    return NextResponse.json({ error: "Failed to run QA agent" }, { status: 500 });
  }
}
