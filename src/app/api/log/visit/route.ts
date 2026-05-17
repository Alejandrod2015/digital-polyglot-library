// First-party visit logger. Called once per page load from the browser
// (see <VisitLogger /> in src/components/VisitLogger.tsx). Merges
// client-side context (path, referrer, UTM, timezone) with server-side
// data Vercel injects on every edge request (geo headers, IP,
// user-agent, accept-language).
//
// Cookie-less from the user's perspective: we set a single httpOnly
// session cookie (`dp_sid`) that is strictly necessary for de-duping
// page-view bursts in the same browsing session. No consent banner
// required.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = "dp_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours sliding window

// Bots and crawlers we explicitly don't want polluting the table.
const BOT_REGEX =
  /(bot|crawl|spider|slurp|preview|monitor|uptime|lighthouse|headless|fetch|curl|httpx|wget|python-requests|axios|nextjs|prerender)/i;

function asTrimmedString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function decodeHeader(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// sha256(ip + salt). Salt comes from env so two deployments with
// different salts produce different hashes for the same IP. We never
// store the raw IP, and we don't truncate further because a 256-bit
// hash already prevents reversal.
function hashIp(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  const salt = process.env.VISIT_IP_SALT || process.env.CLERK_SECRET_KEY || "";
  if (!salt) return null;
  return createHash("sha256").update(`${rawIp}|${salt}`).digest("hex");
}

function pickClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

type Body = {
  path?: unknown;
  referrer?: unknown;
  landingUrl?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  timezone?: unknown;
  deviceCategory?: unknown;
  preConsent?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true }); // silently no-op on bad JSON
  }

  const path = asTrimmedString(body.path, 500);
  if (!path) return NextResponse.json({ ok: true });

  // Skip our own admin/log/api paths so the table stays clean.
  if (
    path.startsWith("/studio") ||
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/auth")
  ) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  if (userAgent && BOT_REGEX.test(userAgent)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  const country = decodeHeader(req.headers.get("x-vercel-ip-country")) ?? null;
  const region = decodeHeader(req.headers.get("x-vercel-ip-country-region")) ?? null;
  const city = decodeHeader(req.headers.get("x-vercel-ip-city")) ?? null;
  const tzServer = req.headers.get("x-vercel-ip-timezone");
  const browserLanguage =
    req.headers.get("accept-language")?.split(",")[0]?.trim().slice(0, 64) ?? null;

  // Manage the session cookie. If it's missing, generate a fresh one
  // and write it back in the response.
  const existingSession = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSession ?? randomBytes(16).toString("base64url");

  const ipHashed = hashIp(pickClientIp(req));

  await prisma.pageVisit.create({
    data: {
      path,
      referrer: asTrimmedString(body.referrer, 500),
      landingUrl: asTrimmedString(body.landingUrl, 500),
      utmSource: asTrimmedString(body.utmSource, 200),
      utmMedium: asTrimmedString(body.utmMedium, 200),
      utmCampaign: asTrimmedString(body.utmCampaign, 200),
      utmContent: asTrimmedString(body.utmContent, 200),
      utmTerm: asTrimmedString(body.utmTerm, 200),
      country,
      region,
      city,
      timezone: asTrimmedString(body.timezone, 100) ?? tzServer ?? null,
      browserLanguage,
      deviceCategory: asTrimmedString(body.deviceCategory, 40),
      userAgent,
      ipHashed,
      sessionId,
      preConsent: body.preConsent === false ? false : true,
    },
  }).catch((err) => {
    // Never fail the user request because of an analytics insert.
    console.error("page-visit insert failed", err);
  });

  const res = NextResponse.json({ ok: true });
  if (!existingSession) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return res;
}
