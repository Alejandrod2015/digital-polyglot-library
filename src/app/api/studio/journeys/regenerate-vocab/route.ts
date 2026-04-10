import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * POST /api/studio/journeys/regenerate-vocab
 * Body: { storyId }
 * Regenerates vocab for a journey story using the Sanity /api/generate-vocab endpoint.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text) return NextResponse.json({ error: "Story has no text" }, { status: 400 });

  try {
    // Call the Sanity vocab generator endpoint internally
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/generate-vocab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.sanity.io",
      },
      body: JSON.stringify({
        text: story.text,
        language: story.journey.language,
        variant: story.journey.variant,
        cefrLevel: story.level,
        topic: story.topic,
        focus: "verbs",
        minItems: 15,
        maxItems: 22,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`generate-vocab failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const vocab = Array.isArray(data?.vocab) ? data.vocab : [];

    if (vocab.length === 0) {
      throw new Error("generate-vocab returned empty vocab");
    }

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { vocab: vocab as any, vocabCount: vocab.length },
    });

    return NextResponse.json({ ok: true, vocabCount: vocab.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
