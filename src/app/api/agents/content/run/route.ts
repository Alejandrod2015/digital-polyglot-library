import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { runContentAgent } from "@/agents/content/agent";

/**
 * POST /api/agents/content/run
 *
 * Receives a CurriculumBrief ID and generates a complete story draft.
 * Auth: Clerk + Studio member check
 *
 * Body: { briefId: string }
 *
 * Response: ContentAgentRun with runId, status, input, output, and toolsUsed
 */
export async function POST(request: NextRequest) {
  // 1. Check auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check studio member
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden: studio member required" }, { status: 403 });
  }

  // 3. Parse request body
  let body: { briefId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { briefId } = body;
  if (!briefId || typeof briefId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid briefId in request body" },
      { status: 400 }
    );
  }

  // 4. Run the agent
  try {
    const result = await runContentAgent(briefId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Content agent failed",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
