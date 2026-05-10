import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";

export const maxDuration = 300;

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

    // Save audio QA data that came back from generation (generateAndUploadAudio includes audioQa)
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioUrl: result.url,
        audioSegments: result.audioSegments as any,
        audioFilename: result.filename,
        audioStatus: "ready",
        voiceId: result.voiceId,
        audioQaStatus: result.audioQa?.status ?? null,
        audioQaScore: result.audioQa?.score ?? null,
        audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      },
    });

    // Run forced alignment (aeneas via Modal) over the full mp3 + plain
    // text. This persists `audioWordTimings` AND overwrites the whisper-
    // derived `audioSegments` with per-sentence boundaries that match the
    // actual end of speech. Practice clips need this precision; the karaoke
    // reader benefits too. Best-effort: if alignment fails, we keep the
    // whisper segments saved above so playback still works.
    let alignmentApplied = false;
    try {
      await generateWordTimingsForStory(storyId);
      alignmentApplied = true;
    } catch (alignError) {
      console.warn(
        "[journeys/audio] aeneas alignment failed, keeping whisper segments:",
        alignError instanceof Error ? alignError.message : alignError
      );
    }

    return NextResponse.json({ ok: true, audioUrl: result.url, audioQa: result.audioQa, alignmentApplied });
  } catch (error) {
    console.error("[journeys/audio] Failed:", error);
    await prisma.journeyStory.update({ where: { id: storyId }, data: { audioStatus: "failed" } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate audio", details: message }, { status: 500 });
  }
}
