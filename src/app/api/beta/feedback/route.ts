// Public beta feedback endpoint, for the form linked from the lifecycle
// emails. No login: a tester reading the email on a laptop has no mobile
// session and often no web session either, and adding a sign-in wall between
// them and a one-sentence answer is how response rates go to zero.
//
// Identity comes from the HMAC-signed email token in the link, the same one
// the unsubscribe links use. It proves the person holds a link we sent to
// that address, which is exactly the level of proof this needs.

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { readEmailToken } from "@/lib/emailPreferences";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

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

  // Two ways in, one table. The token proves you hold a link we mailed to that
  // address; the session proves you are signed in right now. The second exists
  // because the web's own feedback button was a `mailto:` that wrote nowhere:
  // whatever anyone typed there landed in an inbox, never in BetaFeedback, and
  // the Studio's "open feedback" counter could not move no matter how much
  // people wrote. Adding a session path here rather than a second endpoint
  // keeps one contract and one place where feedback is stored.
  const token = typeof body.token === "string" ? body.token : "";
  let email = token ? readEmailToken(token) : null;
  let fromSession = false;
  if (!email) {
    const { userId } = getAuth(req);
    if (userId) {
      const user = await clerkClient.users.getUser(userId).catch(() => null);
      email =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        null;
      fromSession = !!email;
    }
  }
  if (!email) {
    return NextResponse.json(
      { error: "Sign in, or open the link from the email again." },
      { status: 401 },
    );
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
      // Where it actually came from, so triage can tell an answer typed inside
      // the app from one typed on a form opened from an email.
      screen: fromSession ? (typeof body.screen === "string" ? body.screen.slice(0, 80) : "web app") : "email form",
    },
  });

  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
