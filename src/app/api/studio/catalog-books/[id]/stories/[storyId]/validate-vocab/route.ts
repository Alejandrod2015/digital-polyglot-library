// POST /api/studio/catalog-books/[id]/stories/[storyId]/validate-vocab
//
// Re-validates the CatalogStory's current vocab against its text using
// the shared `/api/validate-vocab` pipeline (same pipeline JourneyStory
// uses). Writes the cleaned list back to `prisma.catalogStory.vocab`.
// Mirrors the journey endpoint, with two differences:
//   - Reads language from the parent CatalogBook when the story overrides
//     are null.
//   - Persists as JSON column (not stringified `vocabRaw`).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string; storyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
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
    return NextResponse.json({ error: "Story has no text yet." }, { status: 400 });
  }
  if (!story.vocab) {
    return NextResponse.json({ error: "Story has no vocab yet. Generate one first." }, { status: 400 });
  }

  const language = story.language ?? story.book.language;

  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/validate-vocab`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://www.sanity.io" },
      body: JSON.stringify({
        text: story.text,
        language,
        vocab: story.vocab,
        minItems: 15,
        maxItems: 22,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`validate-vocab failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const cleanedVocab = Array.isArray(data?.vocab) ? data.vocab : [];
    if (cleanedVocab.length === 0) {
      throw new Error("validate-vocab returned an empty list.");
    }

    const updated = await prisma.catalogStory.update({
      where: { id: storyId },
      data: { vocab: cleanedVocab as never },
    });

    revalidatePath(`/studio/catalog-books`);
    revalidatePath(`/stories/${updated.slug}`);

    return NextResponse.json({
      story: { id: updated.id, vocab: updated.vocab },
      count: cleanedVocab.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
