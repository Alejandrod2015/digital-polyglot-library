import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import {
  generateStoryWithLLM,
  generateVocabFromText,
  generateSynopsis,
  generateSlug,
} from "@/agents/content/tools";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";

export const maxDuration = 60;

/**
 * POST /api/studio/journeys/generate
 * Body: { storyId } — generates content for a JourneyStory slot
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
    data: { status: "generated", error: null }, // temp status while generating
  });

  try {
    await loadPedagogicalRules();

    // Check test mode
    let testMode = false;
    try {
      const cfg = await prisma.studioConfig.findUnique({ where: { key: "studio_settings" } });
      if (cfg && typeof cfg.value === "object" && cfg.value !== null && "testMode" in cfg.value) {
        testMode = !!(cfg.value as any).testMode;
      }
    } catch { /* ignore */ }

    // Get existing titles in this journey to avoid duplicates
    const existingStories = await prisma.journeyStory.findMany({
      where: { journeyId: story.journeyId, title: { not: null } },
      select: { title: true },
    });
    const existingTitles = existingStories.map((s) => s.title).filter(Boolean) as string[];

    const generated = await generateStoryWithLLM({
      title: "",
      language: story.journey.language,
      level: story.level,
      topic: story.topic,
      journeyFocus: "General",
      variant: story.journey.variant,
      testMode,
      existingTitles,
    });

    const vocab = await generateVocabFromText({
      text: generated.text,
      language: story.journey.language,
      level: story.level,
      topic: story.topic,
      testMode,
    });

    const synopsis = await generateSynopsis({
      title: generated.title,
      text: generated.text,
      language: story.journey.language,
    });

    const baseSlug = generateSlug(generated.title, story.journey.language, story.journey.variant, 0).replace(/-0$/, "");
    const slug = story.slotIndex > 0 ? `${baseSlug}-${story.slotIndex + 1}` : baseSlug;
    const wordCount = generated.text.split(/\s+/).filter(Boolean).length;

    const updated = await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        status: "generated",
        title: generated.title,
        slug,
        text: generated.text,
        synopsis,
        vocab: vocab as any,
        wordCount,
        vocabCount: vocab.length,
        error: null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
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
