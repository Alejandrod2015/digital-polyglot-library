// POST /api/studio/catalog-books/[id]/stories/[storyId]/generate-vocab
//
// Extracts a vocab list from the CatalogStory's current text. Writes to
// `prisma.catalogStory.vocab` (Json column). Mirrors the StandaloneStory
// endpoint, with two differences:
//   - Reads language/level from book when overrides are null.
//   - Persists as JSON column (not stringified `vocabRaw`).

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateVocabFromText } from "@/agents/content/tools";

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

  if (!story.text || story.text.trim().length === 0) {
    return NextResponse.json(
      { error: "Story has no text yet. Generate or paste the body first." },
      { status: 400 }
    );
  }

  const language = story.language ?? story.book.language;
  const level = story.cefrLevel ?? story.book.cefrLevel ?? story.level ?? story.book.level;
  const topic = story.topic ?? story.book.topic ?? "";

  const raw = await generateVocabFromText({
    text: story.text,
    language,
    level,
    topic,
  });

  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "Vocab generation returned an empty list. Try again or adjust metadata." },
      { status: 502 }
    );
  }

  // Editor reads {word, definition, type}; the helper returns
  // {word, translation, type, example}. Map translation -> definition.
  const normalized = raw.map((item) => ({
    word: item.word,
    definition: item.translation,
    type: item.type,
    ...(item.example ? { example: item.example } : {}),
  }));

  const updated = await prisma.catalogStory.update({
    where: { id: storyId },
    data: { vocab: normalized as never },
  });

  revalidatePath(`/studio/catalog-books`);
  revalidatePath(`/stories/${updated.slug}`);

  return NextResponse.json({
    story: { id: updated.id, vocab: updated.vocab },
    count: normalized.length,
  });
}
