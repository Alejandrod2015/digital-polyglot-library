import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { runPlannerAgent } from "@/agents/planner/agent";
import type { PlannerAgentInput } from "@/agents/planner/types";

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
    const body = (await request.json()) as PlannerAgentInput;
    const mode = body.mode ?? "gaps";

    if (mode === "gaps") {
      if (!body.scope || !["full", "language", "journey"].includes(body.scope)) {
        return NextResponse.json(
          { error: "Invalid scope. Must be 'full', 'language', or 'journey'." },
          { status: 400 }
        );
      }
      if (body.scope === "language" && !body.language) {
        return NextResponse.json(
          { error: "Scope 'language' requires 'language' parameter" },
          { status: 400 }
        );
      }
      if (body.scope === "journey" && !body.journeyTopic) {
        return NextResponse.json(
          { error: "Scope 'journey' requires 'journeyTopic' parameter" },
          { status: 400 }
        );
      }
    } else if (mode === "create-journey") {
      if (!body.newJourneyTopic) {
        return NextResponse.json(
          { error: "Mode 'create-journey' requires 'newJourneyTopic' parameter" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'gaps' or 'create-journey'." },
        { status: 400 }
      );
    }

    const result = await runPlannerAgent(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/agents/planner/run] failed", error);
    return NextResponse.json(
      { error: "Failed to run planner agent" },
      { status: 500 }
    );
  }
}
