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
import { checkAscCredentials, ensureBetaGroup } from "@/lib/appStoreConnect";
import { countActiveTesters } from "@/lib/betaProgram";

export const dynamic = "force-dynamic";

// Enough history to work with, bounded so the page cannot be made slow by a
// spam wave in the applicant table.
const APPLICANT_LIMIT = 500;
const FEEDBACK_LIMIT = 500;

export async function GET(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  // The credential probe hits Apple, so it is opt-in: the page asks for it
  // when you open the health panel, not on every refresh.
  const wantHealth = req.nextUrl.searchParams.get("health") === "1";

  const [applicants, feedback, releases, rules, activeTesters, health] = await Promise.all([
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
  ]);

  return NextResponse.json({
    applicants,
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
