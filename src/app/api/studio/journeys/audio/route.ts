import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio, generateAndUploadMultiVoiceAudio } from "@/lib/elevenlabs";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";
import { multiVoiceGuardError } from "@/lib/multiVoiceGuard";
import { auditTopicArc } from "@/lib/auditTopicArc";
import { judgeTopicContinuity } from "@/lib/judgeTopicContinuity";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; force?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, include: { journey: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text || !story.title) return NextResponse.json({ error: "Story needs text and title before generating audio" }, { status: 400 });

  // HARD GUARD: a story with characters can NEVER be generated single-voice.
  const guardError = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
  if (guardError) return NextResponse.json({ error: guardError }, { status: 400 });

  // CONTINUITY GATE — runs BEFORE generation because audio is the expensive,
  // irreversible step (the A1 LATAM 2026-06-26 incident burned credits on
  // stories that were part of a broken arc). We check the WHOLE topic the
  // story belongs to: deterministic (final-slot cliffhanger, name/role) +
  // semantic LLM judge (plot contradictions, dropped threads). If anything
  // fails, we refuse to spend audio credits. Pass { force: true } to override
  // a judgement you disagree with. See docs/story-quality-spec.md.
  if (!body.force) {
    const topicStories = await prisma.journeyStory.findMany({
      where: { journeyId: story.journeyId, level: story.level, topic: story.topic },
      orderBy: { slotIndex: "asc" },
      select: { slotIndex: true, arcType: true, title: true, text: true, cast: true },
    });
    const blockers: string[] = [];
    for (const i of auditTopicArc(
      topicStories.map((s) => ({
        slotIndex: s.slotIndex,
        arcType: s.arcType,
        title: s.title,
        text: s.text,
        cast: s.cast as { characters?: { name?: string; ageBand?: string; gender?: string }[] } | null,
      })),
      { topicComplete: true }
    )) {
      if (i.severity === "fail") blockers.push(i.message);
    }
    try {
      const verdict = await judgeTopicContinuity(
        topicStories.map((s) => ({ slotIndex: s.slotIndex, title: s.title, text: s.text })),
        { language: story.journey.language, topic: story.topic }
      );
      if (verdict.verdict === "issues") {
        for (const c of verdict.contradictions) blockers.push(`Contradiction (slots ${c.slots.join(", ")}): ${c.detail}`);
        for (const d of verdict.droppedThreads) blockers.push(`Dropped thread (slot ${d.slot}): ${d.detail}`);
        if (verdict.finalCliffhangerUnresolved) blockers.push(`Unresolved final cliffhanger: ${verdict.finalCliffhangerDetail}`);
      }
    } catch {
      // Judge unavailable (e.g. no OPENAI_API_KEY): keep the deterministic
      // blockers; do not silently pass, but do not hard-block on the judge
      // being down either.
    }
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Continuity gate blocked audio generation (the topic this story belongs to has unresolved continuity problems). Fix the arc, or retry with { force: true } if you disagree.",
          topic: `${story.level}/${story.topic}`,
          blockers,
        },
        { status: 422 }
      );
    }
  }

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
    // Exact per-fragment offsets (multi-voice only); null for single-voice.
    let audioFragments: unknown = null;

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
      audioFragments = result.fragments.length > 0 ? result.fragments : null;
    } else {
      // story.voiceId puede traer el prefijo de proveniencia "elevenlabs/"
      // de una generación anterior; se sanea antes de usarlo como override.
      const preferredVoice = story.voiceId?.replace(/^elevenlabs\//, "").trim() || undefined;
      const result = await generateAndUploadAudio(story.text, story.title, story.journey.language, story.journey.variant, preferredVoice);
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
        ...(audioFragments ? { audioFragments: audioFragments as object } : {}),
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
