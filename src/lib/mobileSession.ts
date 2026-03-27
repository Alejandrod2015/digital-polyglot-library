import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export type MobileSessionPayload = {
  aud: "digital-polyglot-mobile";
  sub: string;
  email: string | null;
  name: string | null;
  plan: string | null;
  targetLanguages: string[];
  booksCount: number;
  storiesCount: number;
  iat: number;
  exp: number;
};

const MOBILE_SESSION_AUDIENCE = "digital-polyglot-mobile";
const MOBILE_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getMobileSessionSecret(): string {
  const secret =
    process.env.MOBILE_AUTH_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim() || "";

  if (!secret) {
    throw new Error("Missing MOBILE_AUTH_SECRET or CLERK_SECRET_KEY");
  }

  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(unsignedToken: string): string {
  return createHmac("sha256", getMobileSessionSecret()).update(unsignedToken).digest("base64url");
}

export function createMobileSessionToken(args: {
  userId: string;
  email?: string | null;
  name?: string | null;
  plan?: string | null;
  targetLanguages?: string[];
  booksCount?: number;
  storiesCount?: number;
}): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: MobileSessionPayload = {
    aud: MOBILE_SESSION_AUDIENCE,
    sub: args.userId,
    email: args.email ?? null,
    name: args.name ?? null,
    plan: args.plan ?? null,
    targetLanguages: Array.isArray(args.targetLanguages) ? args.targetLanguages : [],
    booksCount: typeof args.booksCount === "number" ? args.booksCount : 0,
    storiesCount: typeof args.storiesCount === "number" ? args.storiesCount : 0,
    iat: issuedAt,
    exp: issuedAt + MOBILE_SESSION_TTL_SECONDS,
  };

  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${header}.${body}`;
  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyMobileSessionToken(token: string): MobileSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  if (!header || !body || !signature) {
    return null;
  }

  const expectedSignature = sign(`${header}.${body}`);
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as Partial<MobileSessionPayload>;
    if (
      payload.aud !== MOBILE_SESSION_AUDIENCE ||
      typeof payload.sub !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      aud: MOBILE_SESSION_AUDIENCE,
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      plan: typeof payload.plan === "string" ? payload.plan : null,
      targetLanguages: Array.isArray(payload.targetLanguages)
        ? payload.targetLanguages.filter((item): item is string => typeof item === "string")
        : [],
      booksCount: typeof payload.booksCount === "number" ? payload.booksCount : 0,
      storiesCount: typeof payload.storiesCount === "number" ? payload.storiesCount : 0,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getMobileSessionTokenFromRequest(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

export function getMobileSessionFromRequest(req: NextRequest): MobileSessionPayload | null {
  const token = getMobileSessionTokenFromRequest(req);
  if (!token) {
    return null;
  }

  return verifyMobileSessionToken(token);
}
