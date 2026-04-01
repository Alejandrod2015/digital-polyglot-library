import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

type TopicGroup = {
  level: string;
  topicSlug: string;
  total: number;
  draft: number;
  generated: number;
  qa_pass: number;
  qa_fail: number;
  needs_review: number;
  approved: number;
  published: number;
};

/**
 * GET /api/studio/pipeline/topics?language=german&variant=germany
 *
 * Returns CurriculumBriefs grouped by (level, topicSlug) with status counts.
 * Used by the PipelineRunner to show the topic-by-topic queue.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language");
  const variant = searchParams.get("variant");

  const where: Record<string, unknown> = {};
  if (language) where.language = language;
  if (variant) where.variant = variant;

  const briefs = await (prisma as any).curriculumBrief.findMany({
    where,
    select: {
      level: true,
      topicSlug: true,
      status: true,
    },
    orderBy: [{ level: "asc" }, { topicSlug: "asc" }],
  });

  // Group by level+topicSlug
  const map = new Map<string, TopicGroup>();

  for (const brief of briefs) {
    const key = `${brief.level}|${brief.topicSlug}`;
    let group = map.get(key);
    if (!group) {
      group = {
        level: brief.level,
        topicSlug: brief.topicSlug,
        total: 0,
        draft: 0,
        generated: 0,
        qa_pass: 0,
        qa_fail: 0,
        needs_review: 0,
        approved: 0,
        published: 0,
      };
      map.set(key, group);
    }
    group.total++;
    const status = brief.status as string;
    if (status in group) {
      (group as any)[status]++;
    }
  }

  // Sort: by CEFR level order, then topic
  const levelOrder = ["a1", "a2", "b1", "b2", "c1", "c2"];
  const groups = Array.from(map.values()).sort((a, b) => {
    const la = levelOrder.indexOf(a.level.toLowerCase());
    const lb = levelOrder.indexOf(b.level.toLowerCase());
    if (la !== lb) return la - lb;
    return a.topicSlug.localeCompare(b.topicSlug);
  });

  return NextResponse.json({ groups });
}
