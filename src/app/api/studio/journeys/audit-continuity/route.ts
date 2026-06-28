import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { auditTopicArc, auditCrossStoryRepetition } from "@/lib/auditTopicArc";
import { judgeTopicContinuity } from "@/lib/judgeTopicContinuity";

export const maxDuration = 300;

/**
 * POST /api/studio/journeys/audit-continuity
 * Body: { journeyId }
 *
 * The topic-level continuity GATE. Run before publishing/completing a journey.
 * For every topic in the journey it runs:
 *   - auditTopicArc (deterministic: final-slot cliffhanger, name/role conflict)
 *   - judgeTopicContinuity (LLM: contradictions, dropped threads, unresolved
 *     final hook) — best-effort; if OPENAI_API_KEY is missing it reports the
 *     topic as "semantic: unavailable" rather than silently passing.
 * Plus a journey-wide cross-story repetition pass.
 *
 * Returns a consolidated report. This catches exactly the A1 LATAM 2026-06-26
 * class of defects (final-slot cliffhanger, plot contradiction, duplicate/
 * formulaic beats) WITHOUT a human having to read every arc.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const journeyId = typeof body.journeyId === "string" ? body.journeyId : "";
  if (!journeyId) return NextResponse.json({ error: "journeyId required" }, { status: 400 });

  const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, status: "published", NOT: [{ text: null }] },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    select: {
      level: true,
      topic: true,
      slotIndex: true,
      title: true,
      text: true,
      arcType: true,
      cast: true,
    },
  });

  // Group by level::topic.
  const groups = new Map<string, typeof stories>();
  for (const s of stories) {
    const key = `${s.level}::${s.topic}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const topicReports = await Promise.all(
    [...groups.entries()].map(async ([key, topicStories]) => {
      const [level, topic] = key.split("::");
      const deterministic = auditTopicArc(
        topicStories.map((s) => ({
          slotIndex: s.slotIndex,
          arcType: s.arcType,
          title: s.title,
          text: s.text,
          cast: s.cast as { characters?: { name?: string; ageBand?: string; gender?: string }[] } | null,
        })),
        { topicComplete: true }
      );

      let semantic: Awaited<ReturnType<typeof judgeTopicContinuity>> | { unavailable: true; reason: string } | null = null;
      try {
        semantic = await judgeTopicContinuity(
          topicStories.map((s) => ({ slotIndex: s.slotIndex, title: s.title, text: s.text })),
          { language: journey.language, topic }
        );
      } catch (err) {
        semantic = { unavailable: true, reason: err instanceof Error ? err.message : String(err) };
      }

      return { level, topic, slots: topicStories.map((s) => s.slotIndex), deterministic, semantic };
    })
  );

  const repetition = auditCrossStoryRepetition(
    stories.map((s) => ({ label: `${s.level}/${s.topic}/s${s.slotIndex}`, text: s.text }))
  );

  const deterministicFails = topicReports.reduce(
    (n, t) => n + t.deterministic.filter((i) => i.severity === "fail").length,
    0
  );
  const semanticIssueTopics = topicReports.filter(
    (t) => t.semantic && !("unavailable" in t.semantic) && t.semantic.verdict === "issues"
  ).length;

  return NextResponse.json({
    ok: true,
    journey: { id: journey.id, name: journey.name, language: journey.language, variant: journey.variant },
    summary: {
      topics: topicReports.length,
      deterministicFails,
      semanticIssueTopics,
      repetitionWarnings: repetition.length,
      clean: deterministicFails === 0 && semanticIssueTopics === 0,
    },
    topics: topicReports,
    repetition,
  });
}
