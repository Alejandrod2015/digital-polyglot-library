import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

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
// 24h, down from 7 days. The mobile token is a stateless JWT verified by
// signature + exp only (no per-request Clerk/DB lookup), so a long TTL means a
// deleted/revoked Clerk user keeps access until the token expires. A shorter
// TTL bounds that exposure; the app re-exchanges via Clerk (which fails once
// the user is gone). Instant kill still needs the RevokedUser check.
const MOBILE_SESSION_TTL_SECONDS = 60 * 60 * 24;

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

/**
 * Like {@link getMobileSessionFromRequest}, but also rejects tokens whose user
 * has been revoked (e.g. the Clerk user was deleted; see the `user.deleted`
 * webhook). The mobile token is a stateless JWT verified by signature + exp
 * only, so this DB-backed check is the only thing that can invalidate an
 * already-issued token before it expires. Mobile API routes should use this
 * instead of the sync variant.
 *
 * Fails OPEN on a DB error: a transient outage must not sign out every legit
 * user. A deleted user's data is already wiped by the webhook and the token
 * TTL is short, so brief over-permission is low-risk and self-limiting.
 */
export async function getActiveMobileSession(
  req: NextRequest
): Promise<MobileSessionPayload | null> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return null;
  }

  try {
    const revoked = await prisma.revokedUser.findUnique({
      where: { userId: session.sub },
      select: { userId: true },
    });
    if (revoked) {
      return null;
    }
  } catch (err) {
    console.error("[mobile-auth] revocation check failed (failing open):", err);
  }

  // Se ESPERA, no se deja suelta. En serverless la instancia se puede congelar
  // en cuanto sale la respuesta, y una promesa flotante se pierde a medias.
  // El coste es una escritura cada 6 h por instancia y aparato, y la funcion
  // se traga sus propios errores, asi que no puede tumbar la peticion.
  await recordMobileDevice(req, session.sub);

  return session;
}

// Cuánto esperamos antes de volver a tocar la fila del mismo aparato. La
// cabecera viaja en TODA llamada, así que sin esto una sesión de lectura
// escribiría decenas de veces la misma fila para no cambiar nada.
const DEVICE_WRITE_TTL_MS = 6 * 60 * 60 * 1000;

// Caché por instancia: `userId|huella` -> cuándo se escribió. Las instancias
// son efímeras, así que como mucho se pagan unos upserts de más al arrancar
// una nueva; nunca se pierde un aparato, porque la primera llamada de cada
// instancia siempre escribe.
const deviceSeen = new Map<string, number>();

/**
 * Guarda con qué teléfono entra cada persona, leyendo las cabeceras que
 * `apiFetch` manda en todas las llamadas.
 *
 * No bloquea la respuesta y NUNCA propaga su error: es telemetría, y una
 * escritura fallida no puede tumbar la petición que la trajo. Ver el comentario
 * de `MobileDevice` en el schema para el porqué de la tabla.
 */
async function recordMobileDevice(req: NextRequest, userId: string): Promise<void> {
  try {
    const platform = req.headers.get("X-DP-Platform") === "android" ? "android" : "ios";
    const model = (req.headers.get("X-DP-Device") ?? "").slice(0, 120).trim();
    const osVersion = (req.headers.get("X-DP-OS") ?? "").slice(0, 60).trim();
    const rawApp = (req.headers.get("X-DP-App") ?? "").slice(0, 60).trim();

    // Nada que guardar: es una llamada desde la web o desde un binario viejo
    // que todavía no manda las cabeceras.
    if (!model && !osVersion && !rawApp) return;

    // "1.0 (317)" -> version + build. Sin paréntesis, todo es versión.
    const match = /^(.*?)\s*\((.*)\)\s*$/.exec(rawApp);
    const appVersion = (match ? match[1] : rawApp).trim();
    const buildNumber = (match ? match[2] : "").trim();

    const key = `${userId}|${platform}|${model}|${appVersion}|${buildNumber}`;
    const now = Date.now();
    const last = deviceSeen.get(key);
    if (last !== undefined && now - last < DEVICE_WRITE_TTL_MS) return;
    deviceSeen.set(key, now);

    await prisma.mobileDevice.upsert({
      where: {
        userId_platform_model_appVersion_buildNumber: {
          userId,
          platform,
          model,
          appVersion,
          buildNumber,
        },
      },
      create: { userId, platform, model, osVersion, appVersion, buildNumber },
      update: { osVersion, lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error("[mobile-device] no se pudo registrar el aparato:", err);
  }
}
