import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateStoryPayload } from "@/lib/storyGenerator";

export const maxDuration = 60;

function getDetailedRegionDescription(variant?: string, language?: string): string {
  if (!variant) return "";
  const normalizedVariant = variant.trim().toLowerCase();

  const regionDetails: Record<string, Record<string, string>> = {
    spanish: {
      latam: "Latin America, including Colombia, Mexico, Argentina, Peru, and Chile",
      spain: "Spain, including Madrid, Barcelona, Valencia, Seville, and other regions",
    },
    english: {
      us: "United States, including New York, Los Angeles, Chicago, and other major cities",
      uk: "United Kingdom, including London, Manchester, Edinburgh, and other regions",
    },
    portuguese: {
      brazil: "Brazil, including São Paulo, Rio de Janeiro, Salvador, and other major cities",
      portugal: "Portugal, including Lisbon, Porto, and other regions",
    },
    german: {
      germany: "Germany, including Berlin, Munich, Hamburg, and other major cities",
      austria: "Austria, including Vienna, Salzburg, and other regions",
    },
    french: {
      france: "France, including Paris, Lyon, Marseille, and other major cities",
      "canada-fr": "Canada, including Quebec, Montreal, and other French-speaking regions",
    },
    italian: {
      italy: "Italy, including Rome, Milan, Florence, Venice, and other regions",
    },
    korean: {
      "south-korea": "South Korea, including Seoul, Busan, Daegu, and other major cities",
    },
  };

  const langDetails = regionDetails[language?.toLowerCase() ?? ""] ?? {};
  return langDetails[normalizedVariant] || "";
}

/**
 * POST /api/studio/journeys/regenerate-text
 * Body: { storyId } — regenerates ONLY the story text, keeping title/synopsis/vocab
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
  if (!story.title) return NextResponse.json({ error: "Story needs title first" }, { status: 400 });

  try {
    // Get existing stories for context
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

    // Generate new story with existing title and synopsis
    const detailedRegion = getDetailedRegionDescription(story.journey.variant, story.journey.language);
    const payload = await generateStoryPayload({
      language: story.journey.language,
      variant: story.journey.variant,
      region: detailedRegion,
      cefrLevel: story.level,
      topic: story.topic,
      focus: "verbs",
      title: story.title,
      synopsis: story.synopsis || "",
      existingTitles,
      usedCharacterNames,
    });

    if (!payload) {
      throw new Error("Story text generation failed");
    }

    const wordCount = payload.text.split(/\s+/).filter(Boolean).length;

    // Update ONLY the text field, keep title/synopsis/vocab unchanged
    const updated = await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        text: payload.text,
        wordCount,
      },
    });

    return NextResponse.json({
      ok: true,
      wordCount: updated.wordCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
