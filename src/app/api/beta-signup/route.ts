// Public endpoint for the /beta page form. Anyone can submit; no auth.
// Validates shape, enforces consent, dedupes by email, fires a Resend
// confirmation. Admin reviews submissions at /studio/beta-signups.
//
// Antibot stack (added 2026-05-22):
//   1. Honeypot field `website` (hidden in client form). Llega lleno = bot.
//   2. Time-to-submit ≥ 2.5s desde el mount del form (bots scriptados
//      envían en <500ms).
//   3. Rate limit por IP: máx 5 submits/hora.
// Sin CAPTCHA (la fricción no compensa para un beta cerrado). Si crece
// el spam se puede agregar Cloudflare Turnstile como capa adicional.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBetaConfirmationEmail } from "@/lib/email";

const betaSignup = prisma.betaSignup;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_REASON_MIN = 20;
const APPLICATION_REASON_MAX = 1000;
const MIN_SUBMIT_DELAY_MS = 2500;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// In-memory rate limit por IP. En serverless cada instancia warm la
// mantiene; las cold se resetean (lo cual es ok porque cada cold
// arranca con counter=0). Para protección más robusta usar Redis/KV.
const ipHits = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return true;
}

function extractIp(req: NextRequest): string {
  // Vercel inyecta x-forwarded-for con la IP del cliente como primer
  // elemento. Fallback a x-real-ip y luego a "unknown" (todos los
  // "unknown" comparten cuota, lo cual está bien: hace harder bypass).
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

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
  firstName?: unknown;
  email?: unknown;
  appleIdEmail?: unknown;
  socialHandle?: unknown;
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
  // Antibot signals
  website?: unknown;
  clientElapsedMs?: unknown;
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
  // ── Rate limit por IP. Hacer esto ANTES de parsear el body para
  // que un atacante no pueda ni gastar CPU en JSON.parse. ──
  const ip = extractIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Antibot checks ──
  // 1. Honeypot. Si llega lleno, fingimos éxito (no señalizamos el
  // motivo del rechazo para no enseñarle al bot a evitarlo).
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }
  // 2. Time-to-submit. Confiamos en el client (lo bots pueden falsear,
  // pero los tontos no se molestan). Mismo trato silencioso.
  const clientElapsed =
    typeof body.clientElapsedMs === "number" ? body.clientElapsedMs : 0;
  if (clientElapsed < MIN_SUBMIT_DELAY_MS) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  const firstName = asTrimmedString(body.firstName, 80);
  const email = asTrimmedString(body.email, 200)?.toLowerCase();
  const appleIdEmail = asTrimmedString(body.appleIdEmail, 200)?.toLowerCase();
  const socialHandle = asTrimmedString(body.socialHandle, 200);
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
  //
  // Los campos nuevos (firstName, appleIdEmail, socialHandle) van acá
  // en attribution JSON en vez de columnas first-class para evitar
  // schema migration. Si después se queryean mucho, se promueven a
  // columnas con una migration controlada.
  const clientAttribution = normalizeAttribution(body.attribution);
  const serverAttribution = captureServerAttribution(req);
  // Narrowing: ya validamos arriba que firstName y appleIdEmail son
  // strings no vacíos (early return si no lo eran). Re-asserting acá
  // porque TS pierde la inferencia tras el chain `?.toLowerCase()`.
  const profileExtras: Record<string, string> = {
    firstName: firstName as string,
    appleIdEmail: appleIdEmail as string,
  };
  if (socialHandle) profileExtras.socialHandle = socialHandle;
  const mergedAttribution: Record<string, string> = {
    ...clientAttribution,
    ...serverAttribution,
    ...profileExtras,
  };
  const attribution =
    Object.keys(mergedAttribution).length > 0 ? mergedAttribution : null;

  if (!firstName) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!appleIdEmail || !EMAIL_REGEX.test(appleIdEmail)) {
    return NextResponse.json(
      { error: "Valid Apple ID email is required (TestFlight invites go there)" },
      { status: 400 },
    );
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
