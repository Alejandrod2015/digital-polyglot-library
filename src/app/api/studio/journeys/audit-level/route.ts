import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { auditStoryVocabularyLevel } from "@/lib/storyLevelAudit";

export const maxDuration = 60;

/**
 * POST /api/studio/journeys/audit-level
 * Body: { storyId }
 *
 * Returns a holistic CEFR-fit audit: score 0-100, one-sentence summary,
 * and up to 8 illustrative highlights of words that stand out as above
 * the level. Persists score + highlights on the JourneyStory row so
 * the panel rehydrates after refresh.
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

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text) return NextResponse.json({ error: "Story has no text yet" }, { status: 400 });

  try {
    const result = await auditStoryVocabularyLevel({
      text: story.text,
      language: story.journey.language,
      cefrLevel: story.level,
    });
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        auditScore: result.score,
        // The DB column is named `auditOffenders` for legacy reasons but
        // now stores the holistic-audit payload (summary + highlights).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        auditOffenders: { summary: result.summary, highlights: result.highlights } as any,
        auditedAt: new Date(),
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
