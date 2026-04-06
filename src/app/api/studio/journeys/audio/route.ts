import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio } from "@/lib/elevenlabs";

export const maxDuration = 120;

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

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, include: { journey: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text || !story.title) return NextResponse.json({ error: "Story needs text and title before generating audio" }, { status: 400 });

  try {
    await prisma.journeyStory.update({ where: { id: storyId }, data: { audioStatus: "generating" } });

    const result = await generateAndUploadAudio(story.text, story.title, story.journey.language, story.journey.variant);
    if (!result) throw new Error("Audio generation returned null");

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioUrl: result.url,
        audioSegments: result.audioSegments as any,
        audioFilename: result.filename,
        audioStatus: "ready",
      },
    });

    return NextResponse.json({ ok: true, audioUrl: result.url });
  } catch (error) {
    console.error("[journeys/audio] Failed:", error);
    await prisma.journeyStory.update({ where: { id: storyId }, data: { audioStatus: "failed" } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate audio", details: message }, { status: 500 });
  }
}
