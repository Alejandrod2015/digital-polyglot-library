import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

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
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const drafts = await (prisma as any).storyDraft.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ drafts, count: drafts.length });
  } catch (error) {
    console.error("[api/agents/drafts] failed", error);
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const { id, status } = body as { id?: string; status?: string };

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
    }

    const validStatuses = ["draft", "generated", "qa_pass", "qa_fail", "needs_review", "approved", "published"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const draft = await (prisma as any).storyDraft.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("[api/agents/drafts] PATCH failed", error);
    return NextResponse.json({ error: "Failed to update draft" }, { status: 500 });
  }
}
