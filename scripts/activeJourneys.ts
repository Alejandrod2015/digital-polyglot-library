/**
 * activeJourneys.ts; SINGLE SOURCE OF TRUTH for "what counts as a real journey".
 *
 * WHY THIS EXISTS (2026-06-25): twice in one session a vocab review pulled in
 * content that is NOT product and reported wrong counts:
 *   - the archived "Traveler; Legacy (pre-v2)" journey (100 stories, a1/a2/c1/c2)
 *   - the per-journey `deprecated` / `draft` stories (e.g. a2 had 34 rows = 21
 *     published + 12 deprecated + 1 draft "prueba-de-secciones")
 *
 * A real journey = Journey.status === "active"  AND  JourneyStory.status === "published".
 * Each active journey has exactly 21 published stories. NEVER count raw rows.
 *
 * ALWAYS use these helpers in any audit / fix / status / metrics script that
 * touches journeys. Do NOT write ad-hoc `prisma.journeyStory.findMany({ where:{ journeyId }})`
 * that ignores status; that is exactly the bug this file prevents.
 *
 * Usage:
 *   import { getActiveJourneys, getActiveJourneyStories } from "./activeJourneys";
 *   const stories = await getActiveJourneyStories(prisma, { select: { slug:true, vocab:true } });
 */

export const ACTIVE_JOURNEY_WHERE = { status: "active" } as const;
export const PUBLISHED_STORY_STATUS = "published" as const;

type AnyPrisma = {
  journey: { findMany: (args: any) => Promise<any[]> };
  journeyStory: { findMany: (args: any) => Promise<any[]> };
};

/** Active journeys only (excludes archived legacy + any non-active). */
export async function getActiveJourneys(prisma: AnyPrisma, select?: Record<string, boolean>) {
  return prisma.journey.findMany({
    where: ACTIVE_JOURNEY_WHERE,
    ...(select ? { select } : {}),
  });
}

/** Active journey ids only. */
export async function getActiveJourneyIds(prisma: AnyPrisma): Promise<string[]> {
  const js = await prisma.journey.findMany({ where: ACTIVE_JOURNEY_WHERE, select: { id: true } });
  return js.map((j: any) => j.id);
}

/**
 * Published stories of active journeys only. This is THE set to audit/operate on.
 * Pass `select` to shape the rows; pass `level` to narrow to one CEFR level.
 */
export async function getActiveJourneyStories(
  prisma: AnyPrisma,
  opts?: { select?: Record<string, boolean>; level?: string },
) {
  const ids = await getActiveJourneyIds(prisma);
  return prisma.journeyStory.findMany({
    where: {
      journeyId: { in: ids },
      status: PUBLISHED_STORY_STATUS,
      ...(opts?.level ? { level: opts.level } : {}),
    },
    ...(opts?.select ? { select: opts.select } : {}),
    orderBy: [{ journeyId: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });
}
