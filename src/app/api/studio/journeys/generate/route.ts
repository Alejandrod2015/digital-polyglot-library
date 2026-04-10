import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateSynopsis, generateSlug } from "@/agents/content/tools";
import { generateStoryPayload } from "@/lib/storyGenerator";

export const maxDuration = 60;

/**
 * POST /api/studio/journeys/generate
 * Body: { storyId } — generates content for a JourneyStory slot
 * Uses the same high-quality Sanity story generator.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
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

  // Mark as generating
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { status: "generated", error: null },
  });

  try {
    // Get existing titles + character names from same topic to avoid repetition
    const existingStories = await prisma.journeyStory.findMany({
      where: { journeyId: story.journeyId, title: { not: null } },
      select: { title: true, text: true, topic: true },
    });
    const existingTitles = existingStories.map((s) => s.title).filter(Boolean) as string[];

    const sameTopicStories = existingStories.filter((s) => s.topic === story.topic && s.text);
    const usedNames = new Set<string>();
    for (const s of sameTopicStories) {
      const matches = (s.text ?? "").match(/\b[A-Z][a-zà-ü]+(?:\s+[A-Z][a-zà-ü]+)?\b/g) ?? [];
      const stop = new Set(["The", "This", "That", "She", "Her", "His", "They", "But", "And", "One", "When", "After", "Before", "Der", "Die", "Das", "Ein", "Eine", "Und", "Sie", "Ich", "Wir"]);
      for (const m of matches) { if (!stop.has(m)) usedNames.add(m); }
    }
    const usedCharacterNames = [...usedNames].slice(0, 30);

    // Use the same generator as Sanity Studio
    const payload = await generateStoryPayload({
      language: story.journey.language,
      variant: story.journey.variant,
      region: story.journey.variant,
      cefrLevel: story.level,
      topic: story.topic,
      focus: "verbs",
      existingTitles,
      usedCharacterNames,
    });

    if (!payload) {
      throw new Error("Story generation failed after multiple attempts");
    }

    const synopsis = await generateSynopsis({
      title: payload.title,
      text: payload.text,
      language: story.journey.language,
    });

    const baseSlug = generateSlug(payload.title, story.journey.language, story.journey.variant, 0).replace(/-0$/, "");
    const slug = story.slotIndex > 0 ? `${baseSlug}-${story.slotIndex + 1}` : baseSlug;
    const wordCount = payload.text.split(/\s+/).filter(Boolean).length;

    const updated = await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        status: "generated",
        title: payload.title,
        slug,
        text: payload.text,
        synopsis,
        vocab: payload.vocab as any,
        wordCount,
        vocabCount: payload.vocab.length,
        error: null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      wordCount: updated.wordCount,
      vocabCount: updated.vocabCount,
      status: updated.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { status: "draft", error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
