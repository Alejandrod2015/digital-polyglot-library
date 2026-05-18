// POST /api/studio/catalog-books/[id]/stories/[storyId]/generate-audio
//
// Narrates the CatalogStory's title + body via ElevenLabs, uploads to R2,
// writes the URL to `prisma.catalogStory.audioUrl`. Inherits language /
// region from the parent CatalogBook when the story doesn't override.
//
// Audio generation can take 60-120 s on ElevenLabs; raise the maxDuration
// to mirror /api/studio/journeys/audio behaviour.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadAudio } from "@/lib/elevenlabs";

export const maxDuration = 300;

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string; storyId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, storyId } = await params;
  const story = await prisma.catalogStory.findUnique({
    where: { id: storyId },
    include: { book: true },
  });
  if (!story || story.bookId !== id) {
    return NextResponse.json({ error: "Story not found in this book" }, { status: 404 });
  }

  if (!story.text?.trim()) {
    return NextResponse.json(
      { error: "Story has no body text yet. Generate or paste the body first." },
      { status: 400 }
    );
  }
  if (!story.title.trim()) {
    return NextResponse.json({ error: "Story needs a title before generating audio." }, { status: 400 });
  }

  const language = story.language ?? story.book.language;
  const region = story.region ?? story.book.region ?? undefined;

  const result = await generateAndUploadAudio(
    story.text,
    story.title,
    language,
    region
  );

  if (!result?.url) {
    return NextResponse.json(
      { error: "Audio generation failed. Check ElevenLabs/R2 configuration." },
      { status: 502 }
    );
  }

  const updated = await prisma.catalogStory.update({
    where: { id: storyId },
    data: { audioUrl: result.url },
  });

  revalidatePath(`/studio/catalog-books`);
  revalidatePath(`/stories/${updated.slug}`);

  return NextResponse.json({
    story: { id: updated.id, audioUrl: updated.audioUrl },
    filename: result.filename,
    voiceId: result.voiceId,
  });
}
