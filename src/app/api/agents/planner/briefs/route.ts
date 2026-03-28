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
    const language = url.searchParams.get("language");
    const level = url.searchParams.get("level");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (language) where.language = language;
    if (level) where.level = level;
    if (status) where.status = status;

    const briefs = await (prisma as any).curriculumBrief.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      briefs,
      count: briefs.length,
    });
  } catch (error) {
    console.error("[api/agents/planner/briefs] failed", error);
    return NextResponse.json(
      { error: "Failed to fetch planner briefs" },
      { status: 500 }
    );
  }
}
