import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * POST /api/studio/journeys/adjust-level
 * Body: { storyId, wordsToAvoid: string[] }
 *
 * Surgical lexical edit: rewrites only the sentences containing the given
 * offender words with simpler equivalents at the story's CEFR level. The
 * rest of the story stays identical. Cheaper and more predictable than a
 * full Regenerar V2 when the existing narrative is already good.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const storyId = typeof body.storyId === "string" ? body.storyId : "";
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  const wordsToAvoid = Array.isArray(body.wordsToAvoid)
    ? body.wordsToAvoid.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];
  if (wordsToAvoid.length === 0) {
    return NextResponse.json({ error: "wordsToAvoid required" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text) return NextResponse.json({ error: "Story has no text yet" }, { status: 400 });

  const cefrLabel = story.level.toUpperCase();
  const language = story.journey.language;

  const prompt = `
You are editing a ${language} story for a CEFR ${cefrLabel} learner.

The story below is good as a whole, but it uses some words ABOVE level ${cefrLabel}. Your job is a MINIMAL surgical edit: rewrite ONLY the sentences that contain those words, replacing them with simpler equivalents at or below ${cefrLabel}. Keep the rest of the story BYTE-IDENTICAL.

Words to remove (each one is above level ${cefrLabel}): ${wordsToAvoid.join(", ")}

Hard rules:
- Keep the same <blockquote>...</blockquote> structure exactly as in the input.
- Keep character names, places, and proper nouns unchanged.
- Do NOT change the title (it is not part of the input below anyway).
- Do NOT shorten or summarize. Maintain the same approximate length.
- Do NOT rewrite sentences that don't contain any offender word.
- When a single offender word can't be replaced 1-to-1 (e.g. an idiom or a verb with no simple synonym), reformulate the sentence concretely using basic words instead.
- Do NOT introduce new offender words.
- Output the FULL story text (every paragraph), not just the changed sentences.

STORY:
${story.text}

Return ONLY the rewritten story text. No commentary, no explanations.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: `You perform minimal surgical edits on ${language} stories for CEFR alignment. You preserve everything that doesn't need changing. Output plain text only, preserving HTML tags from the input.` },
        { role: "user", content: prompt },
      ],
    });

    const newText = response.choices[0]?.message?.content?.trim() ?? "";
    if (!newText) {
      return NextResponse.json({ error: "Empty rewrite returned" }, { status: 502 });
    }

    const wordCount = newText.split(/\s+/).filter(Boolean).length;
    const updated = await prisma.journeyStory.update({
      where: { id: storyId },
      data: { text: newText, wordCount },
    });

    return NextResponse.json({
      id: updated.id,
      text: updated.text,
      wordCount: updated.wordCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
