import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60;

type JourneyCheckpointTokenPayload = {
  variantId?: string | null;
  levelId: string;
  topicSlug: string;
  answers: Record<string, string>;
  total: number;
  exp: number;
};

function getSecret(): string {
  return process.env.CLERK_SECRET_KEY || process.env.NEXTAUTH_SECRET || "journey-checkpoint-secret";
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createJourneyCheckpointToken(args: {
  variantId?: string | null;
  levelId: string;
  topicSlug: string;
  answers: Record<string, string>;
}): string {
  const payload: JourneyCheckpointTokenPayload = {
    variantId: args.variantId ?? null,
    levelId: args.levelId,
    topicSlug: args.topicSlug,
    answers: args.answers,
    total: Object.keys(args.answers).length,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readJourneyCheckpointToken(token: string): JourneyCheckpointTokenPayload | null {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JourneyCheckpointTokenPayload;
    if (
      !payload ||
      typeof payload.levelId !== "string" ||
      typeof payload.topicSlug !== "string" ||
      typeof payload.total !== "number" ||
      typeof payload.exp !== "number" ||
      !payload.answers ||
      typeof payload.answers !== "object"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
