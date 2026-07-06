// /api/cron/journey-slot-counts
//
// Daily structural check that every topic in every ACTIVE journey has
// exactly 3 published stories (7 topics × 3 = 21 per journey). Triggered
// by Vercel cron (see vercel.json) and callable manually.
//
// Why this exists:
//   The published journey corpus lives in the DB, not in git, so it can
//   drift WITHOUT any code push. On 2026-07-02 the A1 LATAM journey was
//   found sitting at 23 stories instead of 21: two topics had quietly
//   grown a 4th slot (arc-resolution stories added on 2026-06-26). No
//   per-story validator caught it because the invariant is about the
//   SHAPE of the corpus, not any single story.
//
//   A pre-push hook is the wrong net (content changes never touch git);
//   a daily cron watches exactly where the drift happens. If any active
//   journey is off-count we return 500 so the Vercel cron run is flagged
//   in the logs within 24h.
//
// Returns 200 + ok:true when every topic is exactly 3 published.
// Returns 500 + ok:false + the offending (journey, level, topic) list.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkActiveJourneySlotCounts } from "@/lib/journeyInvariants";

export async function GET() {
  const violations = await checkActiveJourneySlotCounts(prisma);
  const ok = violations.length === 0;
  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      violations,
      failures: violations.length,
    },
    { status: ok ? 200 : 500 },
  );
}
