import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { deriveAudioEditorBlocks, deriveBlocksFromFragments } from "@/lib/audioEditorBlocks";
import { resolveVoiceNames, stripVoicePrefix } from "@/lib/audioEditorVoiceNames";

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
      include: { journey: { select: { name: true, language: true, variant: true, topics: true } } },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
    if (!story.audioUrl) {
      return NextResponse.json({ error: "Story has no audio" }, { status: 400 });
    }
    const timings = coerceAudioWordTimings(story.audioWordTimings);
    if (!timings) {
      return NextResponse.json(
        { error: "Story has no word timings; run alignment first" },
        { status: 400 },
      );
    }
    // GROUND-TRUTH per-fragment data (captured at generation/backfill).
    // Synthesis order: index 0 = title (when narrated), then one fragment
    // per dialogue turn. Each carries its own section audio url + text.
    const rawFragments = Array.isArray(story.audioFragments)
      ? (story.audioFragments as unknown as Array<{ startSec?: number; endSec?: number; url?: string | null; prevUrl?: string | null; speaker?: string; voiceId?: string | null; text?: string }>)
      : [];
    const hasFragments = rawFragments.length > 0;
    const dialogueSpecLen = Array.isArray(story.dialogueSpec) ? (story.dialogueSpec as unknown[]).length : 0;
    // Title is fragment 0 when there's exactly one more fragment than turns.
    const titleOffset = hasFragments && rawFragments.length === dialogueSpecLen + 1 ? 1 : 0;

    // Build blocks FROM the fragments (ground truth → never empty) when we
    // have them; else derive from the text (legacy stories without sections).
    const blocks = hasFragments
      ? deriveBlocksFromFragments(
          timings.storyPlainText,
          rawFragments.slice(titleOffset).map((f) => ({ speaker: f.speaker ?? "narrator", voiceId: f.voiceId ?? null, text: f.text ?? "" })),
        )
      : deriveAudioEditorBlocks({
          storyText: story.text ?? "",
          storyPlainText: timings.storyPlainText,
          storyVoiceId: story.voiceId,
          dialogueSpec: story.dialogueSpec,
        });

    const fragmentForBlock = (i: number) => (hasFragments ? rawFragments[i + titleOffset] : undefined);

    // Per-segment in-app regenerate usage (spend cap = 1/segment). The UI
    // shows "X/1" and disables the regenerate button at the cap.
    const REGEN_LIMIT = 1;
    const regenCounts: Record<string, number> =
      story.audioEditorRegenCounts && typeof story.audioEditorRegenCounts === "object" && !Array.isArray(story.audioEditorRegenCounts)
        ? (story.audioEditorRegenCounts as Record<string, number>)
        : {};
    const regensFor = (fragIdx: number | null) =>
      fragIdx == null ? 0 : Number(regenCounts[String(fragIdx)] ?? 0);

    // Per-segment operator comments, keyed by fragment index.
    const comments: Record<string, string> =
      story.audioEditorComments && typeof story.audioEditorComments === "object" && !Array.isArray(story.audioEditorComments)
        ? (story.audioEditorComments as Record<string, string>)
        : {};
    const commentFor = (fragIdx: number | null) =>
      fragIdx == null ? null : comments[String(fragIdx)] ?? null;

    // titleEndSec = where the narrator stops saying the title. Exact from
    // the title fragment when available; else fall back to the first body
    // word's start (aeneas).
    const firstWordWithTime = timings.words.find(
      (w) => typeof w.startSec === "number" && Number.isFinite(w.startSec),
    );
    const titleEndSec =
      titleOffset === 1 && typeof rawFragments[0]?.endSec === "number"
        ? rawFragments[0]!.endSec!
        : firstWordWithTime && typeof firstWordWithTime.startSec === "number"
          ? firstWordWithTime.startSec
          : null;
    // The narrator voice is whatever voice covers char 0; in multi-voice
    // stories that's `dialogueSpec[0].voice` (the title is concatenated
    // with the first narrator segment). For single-voice stories it's
    // `story.voiceId`.
    const narratorVoiceId = blocks.length > 0 ? blocks[0].voiceId : story.voiceId;

    // Resolve human names for every voice in play so the operator knows
    // which ElevenLabs voice to generate a replacement with.
    const nameById = await resolveVoiceNames([
      ...blocks.map((b) => b.voiceId),
      narratorVoiceId,
      story.voiceId,
    ]);
    const enrichedBlocks = blocks.map((b, i) => {
      const cleanId = stripVoicePrefix(b.voiceId);
      const frag = fragmentForBlock(i);
      return {
        ...b,
        voiceId: cleanId || null,
        voiceName: cleanId ? nameById.get(cleanId) ?? null : null,
        // Exact boundaries from generation when available (null → frontend
        // falls back to the word-timing-derived range).
        startSec: typeof frag?.startSec === "number" ? frag.startSec : null,
        endSec: typeof frag?.endSec === "number" ? frag.endSec : null,
        // GROUND TRUTH: this section's standalone audio. When present the
        // editor plays/replaces THIS file; no seeking in the master, so
        // playback is exact (no bleed, starts at the beginning).
        sectionUrl: frag?.url ?? null,
        // Previous take of this section (revert target), if any.
        prevSectionUrl: frag?.prevUrl ?? null,
        // Which entry in audioFragments this block maps to (for section
        // replacement). Null when the story has no captured sections.
        fragmentIndex: hasFragments ? i + titleOffset : null,
        // In-app regenerate spend cap state for this segment.
        regensUsed: regensFor(hasFragments ? i + titleOffset : null),
        regenLimit: REGEN_LIMIT,
        // Operator comment left on this segment, if any.
        comment: commentFor(hasFragments ? i + titleOffset : null),
      };
    });
    // The title's own section audio (fragment 0), when a title was narrated.
    const titleSectionUrl = titleOffset === 1 ? rawFragments[0]?.url ?? null : null;
    const titlePrevSectionUrl = titleOffset === 1 ? rawFragments[0]?.prevUrl ?? null : null;
    const narratorCleanId = stripVoicePrefix(narratorVoiceId);

    return NextResponse.json({
      story: {
        id: story.id,
        slug: story.slug,
        title: story.title,
        level: story.level,
        topic: story.topic,
        slotIndex: story.slotIndex,
        language: story.journey.language,
        variant: story.journey.variant,
        journeyTitle: story.journey.name,
        journeyTopics: story.journey.topics,
        audioUrl: story.audioUrl,
        audioDurationSec: timings.audioDurationSec,
        voiceId: story.voiceId,
        ambientTag: story.ambientTag,
        wordCount: timings.words.length,
        hasPendingPreview: Boolean(story.audioUrlPreview),
        audioUrlPreview: story.audioUrlPreview,
        audioEditorNote: story.audioEditorNote,
        words: timings.words,
        storyPlainText: timings.storyPlainText,
        blocks: enrichedBlocks,
        titleEndSec,
        titleSectionUrl,
        titlePrevSectionUrl,
        titleFragmentIndex: titleOffset === 1 ? 0 : null,
        titleRegensUsed: titleOffset === 1 ? regensFor(0) : 0,
        regenLimit: REGEN_LIMIT,
        titleComment: titleOffset === 1 ? commentFor(0) : null,
        narratorVoiceId: narratorCleanId || null,
        narratorVoiceName: narratorCleanId ? nameById.get(narratorCleanId) ?? null : null,
        isMultiVoice: blocks.length > 1 || (blocks.length === 1 && blocks[0].speakerLabel !== "narrator"),
        // The per-segment regenerate/cut/title routes splice with system
        // ffmpeg/ffprobe, which Vercel's runtime has none of ("spawn
        // ffprobe ENOENT"). They only work locally. On Vercel the worker
        // uses the manual full-audio upload instead. We flag it here so
        // the editor disables those buttons (with a clear note) instead
        // of surfacing the raw spawn error.
        serverCanSplice: !process.env.VERCEL,
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
      level: true,
      topic: true,
      slotIndex: true,
      voiceId: true,
      ambientTag: true,
      audioUrl: true,
      audioUrlPreview: true,
      audioEditorNote: true,
      audioWordTimings: true,
      journey: { select: { name: true, language: true, variant: true, topics: true } },
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
        level: row.level,
        topic: row.topic,
        slotIndex: row.slotIndex,
        language: row.journey.language,
        variant: row.journey.variant,
        journeyTitle: row.journey.name,
        journeyTopics: row.journey.topics,
        audioUrl: row.audioUrl as string,
        audioDurationSec: timings.audioDurationSec,
        voiceId: row.voiceId,
        ambientTag: row.ambientTag,
        wordCount: timings.words.length,
        hasPendingPreview: Boolean(row.audioUrlPreview),
        audioUrlPreview: row.audioUrlPreview,
        audioEditorNote: row.audioEditorNote,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ stories });
}
