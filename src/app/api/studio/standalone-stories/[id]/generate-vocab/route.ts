// POST /api/studio/standalone-stories/[id]/generate-vocab
//
// Extracts a vocab list from the StandaloneStory's current text using the
// pure pipeline-agnostic helper. Writes the result back to
// `StandaloneStory.vocabRaw` only. Does NOT touch JourneyStory,
// StoryDraft, or any /api/studio/journeys|pipeline|agents/* endpoint.

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

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.standaloneStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!story.text || story.text.trim().length === 0) {
    return NextResponse.json(
      { error: "Story has no text yet. Generate or paste the body first." },
      { status: 400 }
    );
  }

  const raw = await generateVocabFromText({
    text: story.text,
    language: story.language ?? "spanish",
    level: story.cefrLevel ?? story.level ?? "a1",
    topic: story.topic ?? story.journeyTopic ?? "",
  });

  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "Vocab generation returned an empty list. Try again or adjust metadata." },
      { status: 502 }
    );
  }

  // The vocab editor reads {word, definition, type}; the helper returns
  // {word, translation, type, example}. Map translation -> definition for
  // editor compatibility and keep example as a note.
  const normalized = raw.map((item) => ({
    word: item.word,
    definition: item.translation,
    type: item.type,
    ...(item.example ? { example: item.example } : {}),
  }));

  const updated = await prisma.standaloneStory.update({
    where: { id },
    data: {
      vocabRaw: JSON.stringify(normalized, null, 2),
    },
  });

  revalidatePath(`/studio/standalone-stories/${id}`);
  revalidatePath("/studio/standalone-stories");

  return NextResponse.json({
    story: { id: updated.id, vocabRaw: updated.vocabRaw },
    count: normalized.length,
  });
}
