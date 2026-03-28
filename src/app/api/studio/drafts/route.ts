import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    // Build query filter
    const where: any = {};
    if (status && status !== "all") {
      where.status = status;
    }

    // Fetch drafts ordered by updatedAt descending
    const drafts = await (prisma as any).storyDraft.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    // Get total count
    const count = await (prisma as any).storyDraft.count({ where });

    return NextResponse.json({ drafts, count });
  } catch (error) {
    console.error("[studio/drafts] GET failed", error);
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const body = await req.json();
    const { id, status, title, text, synopsis, slug } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing draft id" }, { status: 400 });
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (title !== undefined) updateData.title = title;
    if (text !== undefined) updateData.text = text;
    if (synopsis !== undefined) updateData.synopsis = synopsis;
    if (slug !== undefined) updateData.slug = slug;

    const updated = await (prisma as any).storyDraft.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ draft: updated });
  } catch (error) {
    console.error("[studio/drafts] PATCH failed", error);
    return NextResponse.json({ error: "Failed to update draft" }, { status: 500 });
  }
}
