// POST /api/studio/catalog-books/[id]/stories/[storyId]/check-vocab-quality
//
// Runs the heuristic vocab-quality assessment from
// `src/lib/storyVocabQuality.ts` against the CatalogStory's current text.
// Returns a `quality` object the editor uses to decide whether the story
// is rich enough to publish (status: "good" | "usable" | "weak"). Does
// NOT mutate the row — this is a read-only QA check the editor pulls
// on demand. Mirrors `/api/check-story-vocab-quality` but is gated to
// Studio members and resolves language from the parent book.

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { assessStoryVocabQuality } from "@/lib/storyVocabQuality";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

  const text = stripHtml(story.text ?? "");
  if (!text || text.length < 120) {
    return NextResponse.json(
      { error: "El texto es muy corto para evaluar la calidad del vocab (mínimo ~120 caracteres)." },
      { status: 400 }
    );
  }

  const language = story.language ?? story.book.language;
  const quality = assessStoryVocabQuality(text, language);

  return NextResponse.json({ quality });
}
