import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { broadLevelFromCefr } from "@domain/cefr";

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
  if (!story.title) return NextResponse.json({ error: "Story needs title first" }, { status: 400 });

  try {
    const origin = new URL(request.url).origin;
    const broadLevel = broadLevelFromCefr(story.level) ?? "intermediate";
    const res = await fetch(`${origin}/api/generate-synopsis`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://www.sanity.io" },
      body: JSON.stringify({
        title: story.title,
        language: story.journey.language,
        variant: story.journey.variant,
        region: story.journey.variant,
        cefrLevel: story.level,
        level: broadLevel,
        focus: "verbs",
        topic: story.topic,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`generate-synopsis failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const newSynopsis = data.result?.trim();
    if (!newSynopsis) throw new Error("generate-synopsis returned empty");

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { synopsis: newSynopsis },
    });

    return NextResponse.json({ ok: true, synopsis: newSynopsis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
