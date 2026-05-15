// Public endpoint for the /beta page form. Anyone can submit; no auth.
// Validates shape, enforces consent, dedupes by email, fires a Resend
// confirmation. Admin reviews submissions at /studio/beta-signups.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBetaConfirmationEmail } from "@/lib/email";

const betaSignup = prisma.betaSignup;

const VALID_HOURS = ["15min", "1h", "several_hours"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: unknown;
  nativeLanguage?: unknown;
  targetLanguage?: unknown;
  currentLevel?: unknown;
  hasIPhone?: unknown;
  currentApps?: unknown;
  weeklyHours?: unknown;
  referralSource?: unknown;
  consent?: unknown;
};

function asTrimmedString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = asTrimmedString(body.email, 200)?.toLowerCase();
  const nativeLanguage = asTrimmedString(body.nativeLanguage, 100);
  const targetLanguage = asTrimmedString(body.targetLanguage, 100);
  const currentLevel = asTrimmedString(body.currentLevel, 300);
  const weeklyHours = asTrimmedString(body.weeklyHours, 50);
  const currentApps = asTrimmedString(body.currentApps, 500);
  const referralSource = asTrimmedString(body.referralSource, 200);
  const hasIPhone = typeof body.hasIPhone === "boolean" ? body.hasIPhone : null;
  const consent = body.consent === true;

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!nativeLanguage) return NextResponse.json({ error: "Native language is required" }, { status: 400 });
  if (!targetLanguage) return NextResponse.json({ error: "Target language is required" }, { status: 400 });
  if (!currentLevel) return NextResponse.json({ error: "Current level is required" }, { status: 400 });
  if (hasIPhone === null) return NextResponse.json({ error: "iPhone availability is required" }, { status: 400 });
  if (!weeklyHours || !VALID_HOURS.includes(weeklyHours as typeof VALID_HOURS[number])) {
    return NextResponse.json({ error: "Invalid weeklyHours value" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "Consent to data processing is required" }, { status: 400 });
  }

  const existing = await betaSignup.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { ok: true, duplicate: true, message: "We already have your application on file." },
      { status: 200 }
    );
  }

  const signup = await betaSignup.create({
    data: {
      email,
      nativeLanguage,
      targetLanguage,
      currentLevel,
      hasIPhone,
      currentApps,
      weeklyHours,
      referralSource,
      consentedAt: new Date(),
    },
  });

  // Fire-and-forget confirmation; don't block on email failure.
  void sendBetaConfirmationEmail({ to: email, targetLanguage }).catch((err) => {
    console.error("Beta confirmation email failed for", email, err);
  });

  return NextResponse.json({ ok: true, id: signup.id }, { status: 201 });
}
