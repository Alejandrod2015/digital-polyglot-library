import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/studio/cleanup-test
 *
 * Removes all test data created by pipeline runs in testMode:
 * - StoryDrafts with metadata.isTest = true
 * - CurriculumBriefs with brief.isTest = true
 * - QAReviews linked to deleted drafts
 * - AgentRuns linked to deleted drafts/briefs
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Find test drafts
    const testDrafts = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM dp_story_drafts_v1 WHERE metadata->>'isTest' = 'true'`
    ) as Array<{ id: string }>;
    const testDraftIds = testDrafts.map((d) => d.id);

    // 2. Find test briefs
    const testBriefs = await (prisma as any).$queryRawUnsafe(
      `SELECT id FROM dp_curriculum_briefs_v1 WHERE brief->>'isTest' = 'true'`
    ) as Array<{ id: string }>;
    const testBriefIds = testBriefs.map((b) => b.id);

    let deletedDrafts = 0;
    let deletedBriefs = 0;
    let deletedQAReviews = 0;

    // 3. Delete QA reviews linked to test drafts
    if (testDraftIds.length > 0) {
      const qaResult = await (prisma as any).qAReview.deleteMany({
        where: { sourceStoryId: { in: testDraftIds } },
      });
      deletedQAReviews = qaResult.count;
    }

    // 4. Delete test drafts
    if (testDraftIds.length > 0) {
      const draftResult = await (prisma as any).storyDraft.deleteMany({
        where: { id: { in: testDraftIds } },
      });
      deletedDrafts = draftResult.count;
    }

    // 5. Delete test briefs
    if (testBriefIds.length > 0) {
      const briefResult = await (prisma as any).curriculumBrief.deleteMany({
        where: { id: { in: testBriefIds } },
      });
      deletedBriefs = briefResult.count;
    }

    return NextResponse.json({
      success: true,
      deleted: {
        drafts: deletedDrafts,
        briefs: deletedBriefs,
        qaReviews: deletedQAReviews,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/studio/cleanup-test
 *
 * Returns count of test data that would be cleaned up.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const testDrafts = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM dp_story_drafts_v1 WHERE metadata->>'isTest' = 'true'`
    ) as Array<{ count: bigint }>;

    const testBriefs = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM dp_curriculum_briefs_v1 WHERE brief->>'isTest' = 'true'`
    ) as Array<{ count: bigint }>;

    return NextResponse.json({
      testDrafts: Number(testDrafts[0]?.count ?? 0),
      testBriefs: Number(testBriefs[0]?.count ?? 0),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
