// Beta lifecycle engine. Run daily by /api/cron/beta-lifecycle.
//
// For each tester it computes their real state and sends the ONE email that
// applies today, in priority order. Idempotency comes from the BetaEmailLog
// ledger, so a double run, a retry, or a manual invocation all converge on the
// same result.
//
// The ordering is deliberate: a tester who never installed should get the
// install nudge and nothing else, and a tester in the closing week should get
// the final survey rather than a routine feedback ask they no longer have
// time to act on.

import { prisma } from "@/lib/prisma";
import type { BetaRulesConfig } from "@/lib/betaRules";
import { getBetaRules } from "@/lib/betaRulesConfig";
import { sendBetaEmail, betaBaseUrl, hasSentBetaEmail, type BetaSendResult } from "@/lib/betaProgram";
import { createEmailToken } from "@/lib/emailPreferences";
import type { BetaEmailKind } from "@/lib/emails/beta";

const DAY = 24 * 60 * 60 * 1000;
const MAX_TESTERS_PER_RUN = 2000;

function daysSince(from: Date | null | undefined, now: Date): number | null {
  if (!from) return null;
  return Math.floor((now.getTime() - from.getTime()) / DAY);
}

function daysUntil(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / DAY);
}

type TesterRow = {
  id: string;
  email: string;
  firstName: string | null;
  targetLanguage: string;
  status: string;
  invitedAt: Date | null;
  planGrantedAt: Date | null;
  clerkUserId: string | null;
  lastActiveAt: Date | null;
};

export type BetaLifecycleDecision = {
  kind: BetaEmailKind;
  /** Extra payload the builder needs, e.g. the review URL. */
  reviewUrl?: string | null;
} | null;

/**
 * Decides the single email one tester should receive today.
 *
 * Pure: takes state, returns an intent. The caller checks the ledger and
 * sends, which keeps the schedule readable and testable on its own.
 */
export function decideBetaEmail(args: {
  tester: TesterRow;
  now: Date;
  rules: BetaRulesConfig;
  /** Their final-survey rating, if they have answered it. */
  finalRating: number | null;
  alreadySent: Set<string>;
}): BetaLifecycleDecision {
  const { tester, now, rules, finalRating, alreadySent } = args;
  const not = (k: BetaEmailKind) => !alreadySent.has(k);

  // ── Post-launch: the review branch. Runs first because once the app is
  // live, nothing else in the schedule is still relevant. ──
  const daysSinceLaunch = rules.launchedAt ? daysSince(new Date(rules.launchedAt), now) : null;
  if (daysSinceLaunch !== null && daysSinceLaunch >= 0) {
    // Only testers who actually answered the final survey get asked anything.
    // Someone who went quiet has already told us what they think of a favour.
    if (finalRating === null) return null;
    if (finalRating >= rules.reviewAskMinRating) {
      return not("review_ask") ? { kind: "review_ask", reviewUrl: rules.appStoreReviewUrl } : null;
    }
    return not("review_recover") ? { kind: "review_recover" } : null;
  }

  // ── Never signed in: the only thing worth saying is "you are not in yet". ──
  if (tester.status === "invited" && !tester.clerkUserId) {
    const sinceInvite = daysSince(tester.invitedAt, now);
    if (sinceInvite !== null && sinceInvite >= rules.installNudgeAfterDays && not("install_nudge")) {
      return { kind: "install_nudge" };
    }
    return null;
  }

  // Everything below is for testers who are actually in.
  if (tester.status !== "accepted") return null;

  // ── Closing week: the final survey outranks the routine schedule. ──
  const untilEnd = daysUntil(rules.betaEndsAt, now);
  if (
    untilEnd !== null &&
    untilEnd <= rules.finalSurveyBeforeEndDays &&
    untilEnd >= -14 &&
    not("final_survey")
  ) {
    return { kind: "final_survey" };
  }

  const tenure = daysSince(tester.planGrantedAt ?? tester.invitedAt, now);
  if (tenure === null) return null;

  if (tenure >= rules.midSurveyAfterDays && not("mid_survey")) return { kind: "mid_survey" };
  if (tenure >= rules.feedbackAskAfterDays && not("feedback_ask")) return { kind: "feedback_ask" };

  return null;
}

export type BetaLifecycleResult = {
  scanned: number;
  sent: Array<{ email: string; kind: BetaEmailKind; result: BetaSendResult }>;
  skipped: number;
};

export async function runBetaLifecycle(now: Date = new Date()): Promise<BetaLifecycleResult> {
  const rules = await getBetaRules();
  const base = betaBaseUrl();

  const testers = await prisma.betaSignup.findMany({
    where: { status: { in: ["invited", "accepted"] }, planRevokedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      targetLanguage: true,
      // Needed by every send: the lifecycle emails name a store, and naming
      // the wrong one is worse than saying nothing.
      platform: true,
      status: true,
      invitedAt: true,
      planGrantedAt: true,
      clerkUserId: true,
      lastActiveAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: MAX_TESTERS_PER_RUN,
  });

  // Final-survey ratings for everyone in one query. The review branch needs
  // them, and pulling them per tester would be a round trip each.
  const finalAnswers = await prisma.betaFeedback.findMany({
    where: { kind: "final_survey", signupId: { in: testers.map((t) => t.id) } },
    select: { signupId: true, rating: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const finalBySignup = new Map<string, number | null>();
  for (const a of finalAnswers) {
    // Ordered newest first, so the first one seen for a signup is the latest.
    if (a.signupId && !finalBySignup.has(a.signupId)) finalBySignup.set(a.signupId, a.rating);
  }

  // Which kinds each tester already received, in one query.
  const logs = await prisma.betaEmailLog.findMany({
    where: { signupId: { in: testers.map((t) => t.id) } },
    select: { signupId: true, kind: true },
  });
  const sentBySignup = new Map<string, Set<string>>();
  for (const l of logs) {
    const set = sentBySignup.get(l.signupId) ?? new Set<string>();
    set.add(l.kind);
    sentBySignup.set(l.signupId, set);
  }

  const sent: BetaLifecycleResult["sent"] = [];
  let skipped = 0;

  for (const tester of testers) {
    const decision = decideBetaEmail({
      tester,
      now,
      rules,
      finalRating: finalBySignup.get(tester.id) ?? null,
      alreadySent: sentBySignup.get(tester.id) ?? new Set(),
    });

    if (!decision) {
      skipped++;
      continue;
    }

    // Re-check the ledger against the database rather than trusting the
    // snapshot: a Studio action during the run could have sent it already.
    if (await hasSentBetaEmail(tester.id, decision.kind)) {
      skipped++;
      continue;
    }

    // The form has to work for someone who is not logged in on the web, so
    // the link carries the same HMAC-signed email token the unsubscribe links
    // use. A raw row id in a query string would let anyone who saw the URL
    // file reports as that tester.
    const kindParam = decision.kind === "final_survey" || decision.kind === "mid_survey" ? decision.kind : "bug";
    const result = await sendBetaEmail({
      kind: decision.kind,
      signup: tester,
      data: {
        feedbackUrl: `${base}/beta/feedback?token=${encodeURIComponent(createEmailToken(tester.email))}&kind=${kindParam}`,
        reviewUrl: decision.reviewUrl ?? null,
      },
    });
    sent.push({ email: tester.email, kind: decision.kind, result });
  }

  return { scanned: testers.length, sent, skipped };
}
