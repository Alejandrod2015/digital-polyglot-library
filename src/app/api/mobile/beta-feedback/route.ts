// In-app beta feedback, posted from the mobile feedback sheet.
//
// This replaces the `mailto:` link that used to sit in mobile Settings. The
// difference that matters is not the transport, it is that the app attaches
// the build number, the screen and the device on its own: a tester's whole
// job becomes typing one sentence, and every report arrives already tied to
// the build it came from, which is what makes "fixed in build N" possible.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveMobileSession } from "@/lib/mobileSession";

const VALID_KINDS = ["bug", "idea", "confusing", "praise", "mid_survey", "final_survey"] as const;
type FeedbackKind = (typeof VALID_KINDS)[number];

const MESSAGE_MIN = 3;
const MESSAGE_MAX = 4000;

// Per-user rate limit. Generous enough that nobody testing in good faith ever
// meets it, tight enough that a stuck retry loop cannot fill the table.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const userHits = new Map<string, number[]>();

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (userHits.get(userId) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    userHits.set(userId, arr);
    return false;
  }
  arr.push(now);
  userHits.set(userId, arr);
  return true;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

type Body = {
  kind?: unknown;
  message?: unknown;
  rating?: unknown;
  screen?: unknown;
  platform?: unknown;
  appVersion?: unknown;
  buildNumber?: unknown;
  deviceModel?: unknown;
  osVersion?: unknown;
  context?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(session.sub)) {
    return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = str(body.kind, 40) as FeedbackKind | null;
  if (!kind || !VALID_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${VALID_KINDS.join(", ")}` },
      { status: 400 },
    );
  }

  const message = str(body.message, MESSAGE_MAX);
  if (!message || message.length < MESSAGE_MIN) {
    return NextResponse.json({ error: "Tell us what happened" }, { status: 400 });
  }

  // 1-5 for feedback, 0-10 (NPS) for surveys. Out-of-range values are dropped
  // rather than rejected: a bad rating must never cost us the written answer,
  // which is the part with the information in it.
  let rating: number | null = null;
  if (typeof body.rating === "number" && Number.isFinite(body.rating)) {
    const max = kind === "mid_survey" || kind === "final_survey" ? 10 : 5;
    const rounded = Math.round(body.rating);
    if (rounded >= 0 && rounded <= max) rating = rounded;
  }

  const email = session.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Session has no email" }, { status: 400 });
  }

  // Link the report to the application if this tester came through /beta.
  // Nullable on purpose: internal testers and anyone added by hand still get
  // to file feedback, they just have no application row to hang it on.
  const signup = await prisma.betaSignup.findFirst({
    where: { OR: [{ clerkUserId: session.sub }, { email }, { appleIdEmail: email }] },
    select: { id: true },
  });

  const platform = str(body.platform, 20)?.toLowerCase();

  const feedback = await prisma.betaFeedback.create({
    data: {
      signupId: signup?.id ?? null,
      userId: session.sub,
      email,
      platform: platform === "android" ? "android" : "ios",
      appVersion: str(body.appVersion, 40),
      buildNumber: str(body.buildNumber, 40),
      deviceModel: str(body.deviceModel, 80),
      osVersion: str(body.osVersion, 40),
      screen: str(body.screen, 120),
      kind,
      rating,
      message,
      context:
        body.context && typeof body.context === "object"
          ? (body.context as Record<string, unknown>)
          : undefined,
    },
  });

  // Filing a report is also the strongest possible activity signal, so it
  // doubles as an engagement ping.
  if (signup?.id) {
    await prisma.betaSignup
      .update({ where: { id: signup.id }, data: { lastActiveAt: new Date() } })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
