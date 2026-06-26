import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";
import { mergeVoiceProvenance, readVoiceProvenance } from "@/lib/voiceProvenance";

/**
 * POST /api/studio/audio-editor/promote
 *
 * Promote the spliced preview to master and re-run aeneas alignment so
 * word timings match the new waveform (the splice almost certainly
 * shifted everything after the regenerated segment).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; newTitle?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, newTitle } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: {
      audioUrlPreview: true,
      audioFilenamePreview: true,
      title: true,
      voiceProvenance: true,
    },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.audioUrlPreview) {
    return NextResponse.json({ error: "No preview to promote" }, { status: 400 });
  }

  // If the editor session sent a new title (because they regenerated the
  // title clip), persist it now. We only persist the text column; the
  // dialogueSpec[0].text still contains the OLD title concatenated with
  // the narrator opening; that's a known limitation since re-running the
  // full multi-voice pipeline would otherwise revert the title. Flag it
  // back to the caller so they know.
  const titleChanged =
    typeof newTitle === "string" && newTitle.trim().length > 0 && newTitle.trim() !== (story.title ?? "");

  // If the preview was generated via the DRY-STEM path, the new dry
  // stem was uploaded to voiceProvenance.previewDryUrl. Swap it into
  // dryUrl now (and clear the preview slot) so future edits continue
  // using the clean splice path.
  const provenance = readVoiceProvenance(story.voiceProvenance);
  const promotedProvenance = provenance.previewDryUrl
    ? mergeVoiceProvenance(story.voiceProvenance, {
        dryUrl: provenance.previewDryUrl,
        dryFilename: provenance.previewDryFilename ?? null,
        previewDryUrl: null,
        previewDryFilename: null,
      })
    : null;

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioUrl: story.audioUrlPreview,
      audioFilename: story.audioFilenamePreview,
      audioStatus: "ready",
      audioUrlPreview: null,
      audioFilenamePreview: null,
      ...(titleChanged ? { title: newTitle!.trim() } : {}),
      ...(promotedProvenance
        ? { voiceProvenance: promotedProvenance as unknown as object }
        : {}),
    },
  });

  // Re-align so word timings + audioSegments reflect the new waveform.
  let alignmentWarning: string | null = null;
  try {
    await generateWordTimingsForStory(storyId);
  } catch (err) {
    alignmentWarning = err instanceof Error ? err.message : String(err);
    console.warn(`[audio-editor/promote] alignment failed for ${storyId}: ${alignmentWarning}`);
  }

  return NextResponse.json({
    ok: true,
    alignmentWarning,
    titleUpdated: titleChanged,
    dialogueSpecOutOfSync: titleChanged,
    dryStemPromoted: !!promotedProvenance,
  });
}
