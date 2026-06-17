// POST /api/studio/standalone-stories/[id]/generate-audio
//
// Narrates the StandaloneStory's title + body via ElevenLabs, uploads the
// mp3 to R2, and writes the public URL to `StandaloneStory.audioUrl`.
// Pure helper; does NOT touch JourneyStory, StoryDraft, or any
// /api/studio/journeys|pipeline|agents/* endpoint.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { multiVoiceGuardError } from "@/lib/multiVoiceGuard";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.standaloneStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!story.text?.trim()) {
    return NextResponse.json(
      { error: "Story has no body text yet. Generate or paste the body first." },
      { status: 400 }
    );
  }
  if (!story.title.trim()) {
    return NextResponse.json({ error: "Story needs a title before generating audio." }, { status: 400 });
  }

  // HARD GUARD: a story with characters can NEVER be generated single-voice.
  const guardError = multiVoiceGuardError({ storyText: story.text, dialogueSpec: null });
  if (guardError) return NextResponse.json({ error: guardError }, { status: 400 });

  const result = await generateAndUploadAudio(
    story.text,
    story.title,
    story.language ?? undefined,
    story.region ?? undefined
  );

  if (!result?.url) {
    return NextResponse.json(
      { error: "Audio generation failed. Check ElevenLabs/R2 configuration." },
      { status: 502 }
    );
  }

  const updated = await prisma.standaloneStory.update({
    where: { id },
    data: { audioUrl: result.url },
  });

  revalidatePath(`/studio/standalone-stories/${id}`);
  revalidatePath("/studio/standalone-stories");

  return NextResponse.json({
    story: { id: updated.id, audioUrl: updated.audioUrl },
    filename: result.filename,
    voiceId: result.voiceId,
  });
}
