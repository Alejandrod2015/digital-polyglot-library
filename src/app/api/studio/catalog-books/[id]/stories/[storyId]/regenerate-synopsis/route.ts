// POST /api/studio/catalog-books/[id]/stories/[storyId]/regenerate-synopsis
//
// Regenerates just the synopsis for a CatalogStory using the shared
// /api/generate-synopsis pipeline. Inherits language/region/level/topic
// from the parent CatalogBook when the story-level overrides are null.

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { broadLevelFromCefr } from "@domain/cefr";

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
  if (!story.title?.trim()) {
    return NextResponse.json({ error: "Story needs a title before regenerating synopsis." }, { status: 400 });
  }

  const language = story.language ?? story.book.language;
  const variant = story.variant ?? story.book.variant ?? "";
  const region = story.region ?? story.book.region ?? variant;
  const cefrLevel = story.cefrLevel ?? story.book.cefrLevel ?? "";
  const topic = story.topic ?? story.book.topic ?? "";
  const broadLevel = broadLevelFromCefr(cefrLevel) ?? story.level ?? story.book.level ?? "intermediate";

  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/generate-synopsis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://www.sanity.io" },
      body: JSON.stringify({
        title: story.title,
        language,
        variant,
        region,
        cefrLevel,
        level: broadLevel,
        focus: "verbs",
        topic,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`generate-synopsis failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const newSynopsis = typeof data?.result === "string" ? data.result.trim() : "";
    if (!newSynopsis) throw new Error("generate-synopsis returned empty.");

    const updated = await prisma.catalogStory.update({
      where: { id: storyId },
      data: { synopsis: newSynopsis },
    });

    revalidatePath(`/studio/catalog-books`);
    revalidatePath(`/stories/${updated.slug}`);

    return NextResponse.json({
      story: { id: updated.id, synopsis: updated.synopsis },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
