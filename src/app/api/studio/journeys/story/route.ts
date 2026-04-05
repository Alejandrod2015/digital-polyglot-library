import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/studio/journeys/story?id=xxx — get full story content (text, vocab, synopsis)
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id },
    select: {
      id: true, title: true, text: true, synopsis: true, vocab: true,
      wordCount: true, vocabCount: true,
    },
  });

  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(story);
}

/**
 * PATCH /api/studio/journeys/story — update story fields (title, synopsis)
 * Body: { id, title?, synopsis? }
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, title, synopsis } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, string> = {};
  if (title !== undefined) data.title = title;
  if (synopsis !== undefined) data.synopsis = synopsis;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.journeyStory.update({
    where: { id },
    data,
    select: { id: true, title: true, synopsis: true },
  });

  return NextResponse.json(updated);
}
