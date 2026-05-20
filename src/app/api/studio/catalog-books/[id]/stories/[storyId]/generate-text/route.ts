// POST /api/studio/catalog-books/[id]/stories/[storyId]/generate-text
//
// Manual generation entrypoint used by the CatalogBooks inline editor.
// Generates title + body + vocab for one CatalogStory via the same pure
// `generateStoryPayload` helper used by StandaloneStory. Writes only to
// `prisma.catalogStory`. Falls back to the parent CatalogBook's metadata
// when the story-level overrides are null (mirrors how the public reader
// resolves language/level).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateStoryPayload } from "@/lib/storyGenerator";

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

  // Story-level overrides take precedence; otherwise fall back to the
  // parent book's metadata. Same resolution order the reader uses.
  const language = story.language ?? story.book.language;
  const variant = story.variant ?? story.book.variant ?? undefined;
  const region = story.region ?? story.book.region ?? undefined;
  const cefrLevel = story.cefrLevel ?? story.book.cefrLevel ?? undefined;
  const level = story.level ?? story.book.level;
  const topic = story.topic ?? story.book.topic ?? "";

  const payload = await generateStoryPayload({
    language,
    variant,
    region,
    cefrLevel,
    level,
    topic,
    title: story.title || undefined,
  });

  if (!payload) {
    return NextResponse.json(
      { error: "Generation failed after 3 attempts. Adjust metadata and retry." },
      { status: 502 }
    );
  }

  const updated = await prisma.catalogStory.update({
    where: { id: storyId },
    data: {
      title: payload.title || story.title,
      text: payload.text,
      // CatalogStory.vocab is JSON (not String like StandaloneStory.vocabRaw).
      vocab: payload.vocab as never,
    },
  });

  revalidatePath(`/studio/catalog-books`);
  revalidatePath(`/stories/${updated.slug}`);

  return NextResponse.json({
    story: {
      id: updated.id,
      title: updated.title,
      text: updated.text,
      vocab: updated.vocab,
    },
    arcType: payload.arcType,
  });
}
