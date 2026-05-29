// POST /api/studio/catalog-books/[id]/stories/[storyId]/generate-cover
//
// Generates a Flux cover for the CatalogStory's title + body, uploads to
// R2, writes the URL to `prisma.catalogStory.coverUrl`. Inherits
// language/region/level/topic from the parent CatalogBook when the story
// doesn't override them. CatalogStory has no `synopsis` field, so the
// body `text` is used as the prompt seed.

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

  if (!story.title.trim()) {
    return NextResponse.json({ error: "Story needs a title before generating a cover." }, { status: 400 });
  }
  const seed = story.text?.trim() || "";
  if (!seed) {
    return NextResponse.json(
      { error: "Story needs body text to generate a cover from." },
      { status: 400 }
    );
  }

  const language = story.language ?? story.book.language;
  const region = story.region ?? story.book.region ?? undefined;
  const topic = story.topic ?? story.book.topic ?? "";
  const level = story.cefrLevel ?? story.book.cefrLevel ?? story.level ?? story.book.level;

  let result: Awaited<ReturnType<typeof generateAndUploadCover>> = null;
  try {
    result = await generateAndUploadCover({
      title: story.title,
      language,
      region,
      topic,
      level,
      text: seed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[catalog-books/generate-cover] Failed:", err);
    return NextResponse.json(
      { error: "Cover generation failed", details: message },
      { status: 502 }
    );
  }

  if (!result?.url) {
    return NextResponse.json(
      { error: "Cover generation returned no URL" },
      { status: 502 }
    );
  }

  const updated = await prisma.catalogStory.update({
    where: { id: storyId },
    data: { coverUrl: result.url },
  });

  revalidatePath(`/studio/catalog-books`);
  revalidatePath(`/stories/${updated.slug}`);

  return NextResponse.json({
    story: { id: updated.id, coverUrl: updated.coverUrl },
    filename: result.filename,
  });
}
