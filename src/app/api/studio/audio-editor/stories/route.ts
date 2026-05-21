import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { deriveAudioEditorBlocks } from "@/lib/audioEditorBlocks";

/**
 * GET /api/studio/audio-editor/stories
 *   Lists journey stories that have a master audio + word timings ready.
 *
 * GET /api/studio/audio-editor/stories?id=<storyId>
 *   Returns one story's full detail including parsed word timings.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const story = await prisma.journeyStory.findUnique({
      where: { id },
      include: { journey: { select: { name: true, language: true } } },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (!story.audioUrl) {
      return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
    }
    const timings = coerceAudioWordTimings(story.audioWordTimings);
    if (!timings) {
      return NextResponse.json(
        { error: "Story has no word timings — run alignment first" },
        { status: 400 },
      );
    }
    const blocks = deriveAudioEditorBlocks({
      storyText: story.text ?? "",
      storyPlainText: timings.storyPlainText,
      storyVoiceId: story.voiceId,
      dialogueSpec: story.dialogueSpec,
    });

    // titleEndSec = startSec of the first body word with a real timing,
    // which is where the narrator stops saying the title and starts the
    // body. Used to splice a regenerated title without touching the body.
    const firstWordWithTime = timings.words.find(
      (w) => typeof w.startSec === "number" && Number.isFinite(w.startSec),
    );
    const titleEndSec =
      firstWordWithTime && typeof firstWordWithTime.startSec === "number"
        ? firstWordWithTime.startSec
        : null;
    // The narrator voice is whatever voice covers char 0 — in multi-voice
    // stories that's `dialogueSpec[0].voice` (the title is concatenated
    // with the first narrator segment). For single-voice stories it's
    // `story.voiceId`.
    const narratorVoiceId = blocks.length > 0 ? blocks[0].voiceId : story.voiceId;

    return NextResponse.json({
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        language: story.journey.language,
        journeyTitle: story.journey.name,
        audioUrl: story.audioUrl,
        audioDurationSec: timings.audioDurationSec,
        voiceId: story.voiceId,
        ambientTag: story.ambientTag,
        wordCount: timings.words.length,
        hasPendingPreview: Boolean(story.audioUrlPreview),
        audioUrlPreview: story.audioUrlPreview,
        words: timings.words,
        storyPlainText: timings.storyPlainText,
        blocks,
        titleEndSec,
        narratorVoiceId,
        isMultiVoice: blocks.length > 1 || (blocks.length === 1 && blocks[0].speakerLabel !== "narrator"),
      },
    });
  }

  // List mode.
  const rows = await prisma.journeyStory.findMany({
    where: {
      audioUrl: { not: null },
      audioWordTimings: { not: { equals: null as never } },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      voiceId: true,
      ambientTag: true,
      audioUrl: true,
      audioUrlPreview: true,
      audioWordTimings: true,
      journey: { select: { name: true, language: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const stories = rows
    .map((row) => {
      const timings = coerceAudioWordTimings(row.audioWordTimings);
      if (!timings) return null;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        language: row.journey.language,
        journeyTitle: row.journey.name,
        audioUrl: row.audioUrl as string,
        audioDurationSec: timings.audioDurationSec,
        voiceId: row.voiceId,
        ambientTag: row.ambientTag,
        wordCount: timings.words.length,
        hasPendingPreview: Boolean(row.audioUrlPreview),
        audioUrlPreview: row.audioUrlPreview,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ stories });
}
