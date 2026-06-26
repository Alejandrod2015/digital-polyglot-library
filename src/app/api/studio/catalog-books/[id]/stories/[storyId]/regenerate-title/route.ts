// POST /api/studio/catalog-books/[id]/stories/[storyId]/regenerate-title
//
// Regenerates just the title for a CatalogStory using the shared
// /api/generate-title pipeline (same one JourneyStory uses). The slug is
// NOT auto-derived here; catalog story IDs are composite (`bookId:slug`)
// and changing the slug means re-keying the row, which is a separate
// flow (the user can hit "Slug ↻" if they want to align the slug).
//
// Inherits language/region/topic from the parent CatalogBook when the
// story-level overrides are null.

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

  const language = story.language ?? story.book.language;
  const region = story.variant ?? story.book.variant ?? story.region ?? story.book.region ?? "";
  const topic = story.topic ?? story.book.topic ?? "";

  try {
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://www.sanity.io" },
      body: JSON.stringify({
        language,
        region,
        topic,
        synopsis: story.synopsis ?? "",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`generate-title failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const newTitle = typeof data?.result === "string" ? data.result.trim() : "";
    if (!newTitle) throw new Error("generate-title returned empty.");

    const updated = await prisma.catalogStory.update({
      where: { id: storyId },
      data: { title: newTitle },
    });

    revalidatePath(`/studio/catalog-books`);
    revalidatePath(`/stories/${updated.slug}`);

    return NextResponse.json({
      story: { id: updated.id, title: updated.title },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
