// Public beta feedback endpoint, for the form linked from the lifecycle
// emails. No login: a tester reading the email on a laptop has no mobile
// session and often no web session either, and adding a sign-in wall between
// them and a one-sentence answer is how response rates go to zero.
//
// Identity comes from the HMAC-signed email token in the link, the same one
// the unsubscribe links use. It proves the person holds a link we sent to
// that address, which is exactly the level of proof this needs.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readEmailToken } from "@/lib/emailPreferences";

export const dynamic = "force-dynamic";

const VALID_KINDS = ["bug", "idea", "confusing", "praise", "mid_survey", "final_survey"] as const;
type Kind = (typeof VALID_KINDS)[number];

const MESSAGE_MAX = 4000;

// Per-token cap. A survey has a handful of answers; anything past this is
// either a stuck client or someone playing with the endpoint.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => t > now - RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const token = typeof body.token === "string" ? body.token : "";
  const email = readEmailToken(token);
  if (!email) {
    return NextResponse.json({ error: "This link is not valid. Open it from the email again." }, { status: 401 });
  }

  if (!rateLimit(email)) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  const kind = (typeof body.kind === "string" ? body.kind : "bug") as Kind;
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown feedback type" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MESSAGE_MAX) : "";
  if (message.length < 3) {
    return NextResponse.json({ error: "Tell us what happened" }, { status: 400 });
  }

  let rating: number | null = null;
  if (typeof body.rating === "number" && Number.isFinite(body.rating)) {
    const max = kind === "mid_survey" || kind === "final_survey" ? 10 : 5;
    const r = Math.round(body.rating);
    if (r >= 0 && r <= max) rating = r;
  }

  const signup = await prisma.betaSignup.findFirst({
    where: { OR: [{ email }, { appleIdEmail: email }] },
    select: { id: true, clerkUserId: true },
  });

  const feedback = await prisma.betaFeedback.create({
    data: {
      signupId: signup?.id ?? null,
      userId: signup?.clerkUserId ?? null,
      email,
      // The web form has no device to report. Marking it "web" rather than
      // guessing "ios" keeps the triage list honest about where it came from.
      platform: "web",
      kind,
      rating,
      message,
      screen: "email form",
    },
  });

  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
