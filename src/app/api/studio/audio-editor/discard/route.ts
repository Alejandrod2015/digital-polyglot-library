import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { mergeVoiceProvenance, readVoiceProvenance } from "@/lib/voiceProvenance";

/**
 * POST /api/studio/audio-editor/discard
 *
 * Clear the spliced preview without touching the master. The R2 object is
 * left behind (cheap, immutable URL) but the DB columns are nulled.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  // Also clear voiceProvenance.previewDryUrl so the next edit session
  // doesn't see a stale pointer. We have to read first because the
  // JSON column is opaque to partial updates.
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { voiceProvenance: true },
  });
  const provenance = readVoiceProvenance(story?.voiceProvenance);
  const clearedProvenance =
    provenance.previewDryUrl || provenance.previewDryFilename
      ? mergeVoiceProvenance(story?.voiceProvenance, {
          previewDryUrl: null,
          previewDryFilename: null,
        })
      : null;

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioUrlPreview: null,
      audioFilenamePreview: null,
      ...(clearedProvenance
        ? { voiceProvenance: clearedProvenance as unknown as object }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
