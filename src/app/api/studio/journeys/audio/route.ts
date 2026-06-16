import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio, generateAndUploadMultiVoiceAudio } from "@/lib/elevenlabs";
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

    type DialogueSeg = { speaker: string; voice: string; text: string };
    const spec = story.dialogueSpec as DialogueSeg[] | null;
    const useMultiVoice = Array.isArray(spec) && spec.length > 0;

    let audioUrl: string;
    let audioFilename: string;
    let audioSegments: any[];
    let audioQa: any;
    let savedVoiceId: string | null;

    if (useMultiVoice) {
      // Build voiceMap from dialogueSpec: speaker.toLowerCase() → voiceId
      const voiceMap: Record<string, string> = {};
      for (const seg of spec!) {
        if (seg.speaker && seg.voice) voiceMap[seg.speaker.toLowerCase()] = seg.voice;
      }
      const result = await generateAndUploadMultiVoiceAudio({
        storyText: story.text,
        title: story.title,
        voiceMap,
        language: story.journey.language ?? undefined,
        disableStitching: true,
      });
      if (!result) throw new Error("Multi-voice audio generation returned null");
      audioUrl = result.url;
      audioFilename = result.filename;
      audioSegments = result.audioSegments;
      audioQa = result.audioQa;
      savedVoiceId = result.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null;
    } else {
      const result = await generateAndUploadAudio(story.text, story.title, story.journey.language, story.journey.variant);
      if (!result) throw new Error("Audio generation returned null");
      audioUrl = result.url;
      audioFilename = result.filename;
      audioSegments = result.audioSegments;
      audioQa = result.audioQa;
      savedVoiceId = result.voiceId;
    }

    // Save audio QA data that came back from generation
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        audioUrl,
        audioSegments: audioSegments as any,
        audioFilename,
        audioStatus: "ready",
        voiceId: savedVoiceId,
        audioQaStatus: audioQa?.status ?? null,
        audioQaScore: audioQa?.score ?? null,
        audioQaNotes: audioQa?.notes?.join("\n") ?? null,
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

    return NextResponse.json({ ok: true, audioUrl, audioQa, alignmentApplied });
  } catch (error) {
    console.error("[journeys/audio] Failed:", error);
    await prisma.journeyStory.update({ where: { id: storyId }, data: { audioStatus: "failed" } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate audio", details: message }, { status: 500 });
  }
}
