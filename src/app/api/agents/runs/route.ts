import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { getAgentRuns } from "@/lib/agentPersistence";
import type { AgentKind } from "@/agents/types";

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
    const kind = url.searchParams.get("kind") as AgentKind | null;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    if (!kind || !["planner", "content", "qa"].includes(kind)) {
      return NextResponse.json(
        { error: "Invalid or missing 'kind' query parameter. Must be 'planner', 'content', or 'qa'." },
        { status: 400 }
      );
    }

    const runs = await getAgentRuns(kind, limit);
    return NextResponse.json({ runs });
  } catch (error) {
    console.error("[api/agents/runs] failed", error);
    return NextResponse.json({ error: "Failed to fetch agent runs" }, { status: 500 });
  }
}
