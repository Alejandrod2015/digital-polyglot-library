import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

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
  if (!story.text || !story.vocab) return NextResponse.json({ error: "Story needs text and vocab" }, { status: 400 });

  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/validate-vocab`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://www.sanity.io" },
      body: JSON.stringify({
        text: story.text,
        language: story.journey.language,
        vocab: story.vocab,
        minItems: 15,
        maxItems: 22,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`validate-vocab failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const cleanedVocab = Array.isArray(data?.vocab) ? data.vocab : [];

    if (cleanedVocab.length === 0) {
      throw new Error("validate-vocab returned empty");
    }

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { vocab: cleanedVocab as any, vocabCount: cleanedVocab.length },
    });

    return NextResponse.json({ ok: true, vocabCount: cleanedVocab.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
