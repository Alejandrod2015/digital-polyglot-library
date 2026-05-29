// POST /api/studio/standalone-stories/[id]/generate-cover
//
// Generates a Flux cover image for the StandaloneStory's title/synopsis,
// uploads it to R2, and stores the public URL in
// `StandaloneStory.coverUrl`. Pure helper; does NOT touch JourneyStory,
// StoryDraft, or any /api/studio/journeys|pipeline|agents/* endpoint.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateAndUploadCover } from "@/lib/dalle";

// Flux polling can take up to ~90s (36 attempts × 2.5s) for cover
// generation. Without this, the Vercel default kills the function
// mid-poll and the route returns the generic "Flux/R2 configuration"
// error. Mirrors `/api/studio/journeys/cover/route.ts` (maxDuration=120).
export const maxDuration = 120;

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

  if (!story.title.trim()) {
    return NextResponse.json({ error: "Story needs a title before generating a cover." }, { status: 400 });
  }

  // The cover prompt is driven by synopsis (preferred) or body fallback.
  const seed = story.synopsis?.trim() || story.text?.trim() || "";
  if (!seed) {
    return NextResponse.json(
      { error: "Story needs a synopsis or body text to generate a cover from." },
      { status: 400 }
    );
  }

  const result = await generateAndUploadCover({
    title: story.title,
    language: story.language ?? "spanish",
    region: story.region ?? undefined,
    topic: story.topic ?? story.journeyTopic ?? "",
    level: story.cefrLevel ?? story.level ?? "a1",
    text: seed,
  });

  if (!result?.url) {
    return NextResponse.json(
      { error: "Cover generation failed. Check Flux/R2 configuration." },
      { status: 502 }
    );
  }

  const updated = await prisma.standaloneStory.update({
    where: { id },
    data: { coverUrl: result.url },
  });

  revalidatePath(`/studio/standalone-stories/${id}`);
  revalidatePath("/studio/standalone-stories");

  return NextResponse.json({
    story: { id: updated.id, coverUrl: updated.coverUrl },
    filename: result.filename,
  });
}
