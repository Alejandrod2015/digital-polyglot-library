import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateVocabFromText } from "@/agents/content/tools";

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
  if (!story.text) return NextResponse.json({ error: "Story has no text" }, { status: 400 });

  try {
    // Check test mode
    let testMode = false;
    try {
      const cfg = await prisma.studioConfig.findUnique({ where: { key: "studio_settings" } });
      if (cfg && typeof cfg.value === "object" && cfg.value !== null && "testMode" in cfg.value) {
        testMode = !!(cfg.value as any).testMode;
      }
    } catch { /* ignore */ }

    const vocab = await generateVocabFromText({
      text: story.text,
      language: story.journey.language,
      level: story.level,
      topic: story.topic,
      testMode,
    });

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
