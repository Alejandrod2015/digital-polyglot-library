// Public endpoint for the /beta page form. Anyone can submit; no auth.
// Validates shape, enforces consent, dedupes by email, fires a Resend
// confirmation. Admin reviews submissions at /studio/beta-signups.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBetaConfirmationEmail } from "@/lib/email";

const betaSignup = prisma.betaSignup;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_REASON_MIN = 20;
const APPLICATION_REASON_MAX = 1000;

type AttributionInput = {
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  referrer?: unknown;
  landingUrl?: unknown;
};

type Body = {
  email?: unknown;
  nativeLanguage?: unknown;
  targetLanguage?: unknown;
  currentLevel?: unknown;
  hasIPhone?: unknown;
  weeklyHours?: unknown;
  motivation?: unknown;
  referralSource?: unknown;
  applicationReason?: unknown;
  consent?: unknown;
  attribution?: AttributionInput;
};

function asTrimmedString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeAttribution(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as AttributionInput;
  const fields: Array<[string, unknown]> = [
    ["utmSource", src.utmSource],
    ["utmMedium", src.utmMedium],
    ["utmCampaign", src.utmCampaign],
    ["utmContent", src.utmContent],
    ["utmTerm", src.utmTerm],
    ["referrer", src.referrer],
    ["landingUrl", src.landingUrl],
  ];
  const cleaned: Record<string, string> = {};
  for (const [key, value] of fields) {
    const str = asTrimmedString(value, 500);
    if (str) cleaned[key] = str;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
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
  const hasIPhone = typeof body.hasIPhone === "boolean" ? body.hasIPhone : null;
  const weeklyHours = asTrimmedString(body.weeklyHours, 100);
  const motivation = asTrimmedString(body.motivation, 200);
  const referralSource = asTrimmedString(body.referralSource, 200);
  const applicationReason = asTrimmedString(body.applicationReason, APPLICATION_REASON_MAX);
  const consent = body.consent === true;
  const attribution = normalizeAttribution(body.attribution);

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!nativeLanguage) return NextResponse.json({ error: "Native language is required" }, { status: 400 });
  if (!targetLanguage) return NextResponse.json({ error: "Target language is required" }, { status: 400 });
  if (!currentLevel) return NextResponse.json({ error: "Current level is required" }, { status: 400 });
  if (hasIPhone === null) return NextResponse.json({ error: "iPhone availability is required" }, { status: 400 });
  if (!weeklyHours) return NextResponse.json({ error: "Weekly hours is required" }, { status: 400 });
  if (!motivation) return NextResponse.json({ error: "Reason for learning is required" }, { status: 400 });
  if (!referralSource) {
    return NextResponse.json({ error: "Please tell us how you heard about us" }, { status: 400 });
  }
  if (!applicationReason) {
    return NextResponse.json({ error: "Please tell us why you're applying" }, { status: 400 });
  }
  if (applicationReason.length < APPLICATION_REASON_MIN) {
    return NextResponse.json(
      { error: `Please write at least ${APPLICATION_REASON_MIN} characters about why you're applying` },
      { status: 400 },
    );
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
      weeklyHours,
      motivation,
      referralSource,
      applicationReason,
      attribution: attribution ?? undefined,
      consentedAt: new Date(),
    },
  });

  // Fire-and-forget confirmation; don't block on email failure.
  void sendBetaConfirmationEmail({ to: email, targetLanguage }).catch((err) => {
    console.error("Beta confirmation email failed for", email, err);
  });

  return NextResponse.json({ ok: true, id: signup.id }, { status: 201 });
}
