import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { analyzeExistingAudio, buildAudioNarrationText } from "@/lib/elevenlabs";

import { signAudioUrl } from "@/lib/mediaSigning";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.audioUrl) return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
  if (!story.title || !story.text) return NextResponse.json({ error: "Story needs title and text" }, { status: 400 });

  try {
    // La QA se baja el mp3 aqui mismo, asi que va por la URL firmada.
    const response = await fetch(signAudioUrl(story.audioUrl) ?? story.audioUrl);
    if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`);

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const expectedNarration = buildAudioNarrationText(story.title, story.text);
    const audioQa = await analyzeExistingAudio(audioBuffer, expectedNarration, story.title);

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioQaStatus: audioQa.status,
        audioQaScore: audioQa.score,
        audioQaNotes: audioQa.notes.join("\n"),
      },
    });

    return NextResponse.json({ ok: true, audioQa });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
