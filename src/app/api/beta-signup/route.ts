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

function normalizeAttribution(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as AttributionInput & { timezone?: unknown };
  const fields: Array<[string, unknown]> = [
    ["utmSource", src.utmSource],
    ["utmMedium", src.utmMedium],
    ["utmCampaign", src.utmCampaign],
    ["utmContent", src.utmContent],
    ["utmTerm", src.utmTerm],
    ["referrer", src.referrer],
    ["landingUrl", src.landingUrl],
    ["timezone", src.timezone],
  ];
  const cleaned: Record<string, string> = {};
  for (const [key, value] of fields) {
    const str = asTrimmedString(value, 500);
    if (str) cleaned[key] = str;
  }
  return cleaned;
}

// Pull geo + language + UA from the request. Vercel injects geo headers
// for every edge request; on local dev they're absent and we get
// undefined, which is fine.
function captureServerAttribution(req: NextRequest): Record<string, string> {
  const h = req.headers;
  const decode = (v: string | null) => {
    if (!v) return undefined;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const out: Record<string, string> = {};
  const country = decode(h.get("x-vercel-ip-country"));
  const region = decode(h.get("x-vercel-ip-country-region"));
  const city = decode(h.get("x-vercel-ip-city"));
  const tz = h.get("x-vercel-ip-timezone");
  // Keep only the primary preferred language tag (e.g. "en-US" from
  // "en-US,en;q=0.9,es;q=0.8").
  const lang = h.get("accept-language")?.split(",")[0]?.trim();
  const ua = h.get("user-agent")?.slice(0, 500);
  if (country) out.country = country;
  if (region) out.region = region;
  if (city) out.city = city;
  if (tz) out.timezoneServer = tz;
  if (lang) out.browserLanguage = lang;
  if (ua) out.userAgent = ua;
  return out;
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
  // Merge browser-side attribution (utm, referrer, landing url, tz) with
  // server-side attribution (geo from Vercel + accept-language + user-agent).
  // Server side is the trustier source, so it overrides if both are present.
  const clientAttribution = normalizeAttribution(body.attribution);
  const serverAttribution = captureServerAttribution(req);
  const mergedAttribution: Record<string, string> = {
    ...clientAttribution,
    ...serverAttribution,
  };
  const attribution =
    Object.keys(mergedAttribution).length > 0 ? mergedAttribution : null;

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
