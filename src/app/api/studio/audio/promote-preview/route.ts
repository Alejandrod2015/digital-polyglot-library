import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { audioUrlPreview: true, audioFilenamePreview: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.audioUrlPreview) return NextResponse.json({ error: "No preview to promote" }, { status: 400 });

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioUrl: story.audioUrlPreview,
      audioFilename: story.audioFilenamePreview,
      audioSegments: [],
      audioStatus: "ready",
      audioQaStatus: null,
      audioQaScore: null,
      audioQaNotes: null,
      audioUrlPreview: null,
      audioFilenamePreview: null,
    },
  });

  return NextResponse.json({ ok: true });
}
