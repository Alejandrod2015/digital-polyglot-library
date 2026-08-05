// Beta program overview for /studio/beta. Admin only.
//
// GET → everything the page renders in one round trip: applicants, feedback,
//       releases, the live rules, and whether App Store Connect is reachable.
// PUT → update the rules (thresholds, capacity, program dates).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";
import type { BetaRulesConfig } from "@/lib/betaRules";
import { getBetaRules, saveBetaRules } from "@/lib/betaRulesConfig";
import { checkAscCredentials, ensureBetaGroup, listGroupTesterStates } from "@/lib/appStoreConnect";
import { countActiveTesters } from "@/lib/betaProgram";

export const dynamic = "force-dynamic";

// Enough history to work with, bounded so the page cannot be made slow by a
// spam wave in the applicant table.
const APPLICANT_LIMIT = 500;
const FEEDBACK_LIMIT = 500;

// Rows left behind by testing the program on itself. They are hidden rather
// than deleted, and counted rather than silently dropped.
//
// Not cosmetic: one of them sits at `invited` with no Apple record, which is
// exactly the condition the new "Blocked at Apple" alarm fires on. Left in, the
// panel would show a permanent count of 1 for a person who does not exist, and
// an alarm that is always on is an alarm nobody reads.
const TEST_ROW = /betatest|postmigration|example\.com/i;

export async function GET(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  // The credential probe hits Apple, so it is opt-in: the page asks for it
  // when you open the health panel, not on every refresh.
  const wantHealth = req.nextUrl.searchParams.get("health") === "1";

  const [allApplicants, feedback, releases, rules, activeTesters, health, appleStates] = await Promise.all([
    prisma.betaSignup.findMany({
      orderBy: { createdAt: "desc" },
      take: APPLICANT_LIMIT,
      include: {
        _count: { select: { feedback: true } },
      },
    }),
    prisma.betaFeedback.findMany({
      orderBy: { createdAt: "desc" },
      take: FEEDBACK_LIMIT,
      include: { signup: { select: { id: true, firstName: true, email: true } } },
    }),
    prisma.betaRelease.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    getBetaRules(),
    countActiveTesters(),
    wantHealth ? checkAscCredentials() : Promise.resolve(null),
    // What APPLE holds, as opposed to what we decided. Not opt-in like the
    // credential probe: the mismatch between the two is the whole reason this
    // panel is worth opening. Our first real applicant sat at NOT_INVITED for
    // a day while this page showed her as `invited` in green and her email
    // told her to look for a message Apple had never sent.
    listGroupTesterStates(),
  ]);

  const applicants = allApplicants.filter((a) => !TEST_ROW.test(a.email));
  const hiddenTestRows = allApplicants.length - applicants.length;

  // Real usage per tester, derived from UserMetric rather than kept as its own
  // column. A duplicated counter drifts the moment one write path forgets to
  // increment it; the event log is already the truth, and with a tester cap of
  // 20 this is one grouped query, not N.
  //
  // `lastActiveAt` on the applicant row is a coarse "opened the app" stamp from
  // the session endpoint. `lastEventAt` below is the real one: it moves when
  // they actually read or listen to something.
  const testerUserIds = applicants
    .map((a) => a.clerkUserId)
    .filter((id): id is string => Boolean(id));

  const usage = new Map<
    string,
    { stories: number; audioPlays: number; audioCompletes: number; practice: number; lastEventAt: string | null }
  >();

  if (testerUserIds.length > 0) {
    const [grouped, latest] = await Promise.all([
      prisma.userMetric.groupBy({
        by: ["userId", "eventType"],
        where: { userId: { in: testerUserIds } },
        _count: { _all: true },
      }),
      prisma.userMetric.groupBy({
        by: ["userId"],
        where: { userId: { in: testerUserIds } },
        _max: { createdAt: true },
      }),
    ]);

    for (const id of testerUserIds) {
      usage.set(id, { stories: 0, audioPlays: 0, audioCompletes: 0, practice: 0, lastEventAt: null });
    }
    for (const g of grouped) {
      const u = usage.get(g.userId);
      if (!u) continue;
      const n = g._count._all;
      if (g.eventType === "story_opened") u.stories += n;
      else if (g.eventType === "audio_play") u.audioPlays += n;
      else if (g.eventType === "audio_complete") u.audioCompletes += n;
      else if (g.eventType === "practice_session_completed") u.practice += n;
    }
    for (const l of latest) {
      const u = usage.get(l.userId);
      if (u) u.lastEventAt = l._max.createdAt?.toISOString() ?? null;
    }
  }

  // An empty map means Apple could not be reached, not that nobody is a
  // tester. Distinguishing the two matters: "unknown" is a prompt to look,
  // while a blank state next to `invited` reads as confirmation.
  const appleReachable = appleStates.size > 0;

  return NextResponse.json({
    applicants: applicants.map((a) => ({
      ...a,
      usage: a.clerkUserId ? (usage.get(a.clerkUserId) ?? null) : null,
      apple: !a.ascTesterId
        ? null
        : appleReachable
          ? (appleStates.get(a.ascTesterId) ?? { state: "GONE", group: "", isInternal: false })
          : { state: "UNREACHABLE", group: "", isInternal: false },
    })),
    appleReachable,
    hiddenTestRows,
    feedback,
    releases,
    rules,
    stats: {
      activeTesters,
      byStatus: applicants.reduce<Record<string, number>>((acc, a) => {
        acc[a.status] = (acc[a.status] ?? 0) + 1;
        return acc;
      }, {}),
      openFeedback: feedback.filter((f) => f.status === "new" || f.status === "triaged").length,
    },
    health,
  });
}

// Creates the external TestFlight group if it is missing. Idempotent, and the
// only write this route makes against Apple. Kept here rather than made a
// setup step in a document, because a setup step in a document is one that
// eventually gets done wrong.
export async function POST() {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const result = await ensureBetaGroup();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

const NUMERIC_FIELDS: Array<keyof BetaRulesConfig> = [
  "autoAcceptAt",
  "autoDeclineBelow",
  "maxActiveTesters",
  "installNudgeAfterDays",
  "feedbackAskAfterDays",
  "midSurveyAfterDays",
  "finalSurveyBeforeEndDays",
  "reviewAskMinRating",
];

const DATE_FIELDS: Array<keyof BetaRulesConfig> = ["betaEndsAt", "launchedAt"];

export async function PUT(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Partial<BetaRulesConfig> = {};

  for (const field of NUMERIC_FIELDS) {
    const raw = body[field];
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 });
    }
    (patch as Record<string, unknown>)[field] = Math.round(n);
  }

  for (const field of DATE_FIELDS) {
    const raw = body[field];
    if (raw === undefined) continue;
    if (raw === null || raw === "") {
      (patch as Record<string, unknown>)[field] = null;
      continue;
    }
    if (typeof raw !== "string" || Number.isNaN(new Date(raw).getTime())) {
      return NextResponse.json({ error: `${field} must be an ISO date or null` }, { status: 400 });
    }
    (patch as Record<string, unknown>)[field] = new Date(raw).toISOString();
  }

  if (body.autoInviteEnabled !== undefined) {
    patch.autoInviteEnabled = body.autoInviteEnabled === true;
  }

  if (body.appStoreReviewUrl !== undefined) {
    const url = typeof body.appStoreReviewUrl === "string" ? body.appStoreReviewUrl.trim() : "";
    patch.appStoreReviewUrl = url || null;
  }

  if (body.acceptedTargetLanguages !== undefined) {
    if (!Array.isArray(body.acceptedTargetLanguages)) {
      return NextResponse.json({ error: "acceptedTargetLanguages must be an array" }, { status: 400 });
    }
    patch.acceptedTargetLanguages = body.acceptedTargetLanguages
      .filter((l): l is string => typeof l === "string")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  // A decline floor above the accept bar would leave no review band at all and
  // silently turn the queue off, so it is rejected rather than clamped.
  const merged = { ...(await getBetaRules()), ...patch };
  if (merged.autoDeclineBelow > merged.autoAcceptAt) {
    return NextResponse.json(
      { error: "autoDeclineBelow cannot be higher than autoAcceptAt" },
      { status: 400 },
    );
  }

  const saved = await saveBetaRules(patch, check.email);
  return NextResponse.json({ ok: true, rules: saved });
}
