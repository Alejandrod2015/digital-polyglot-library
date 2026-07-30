// Minimal FCM HTTP v1 (Firebase Cloud Messaging) sender — the Android
// counterpart of `apnsPush.ts`.
//
// Reuses the native FCM device tokens stored in Clerk
// `privateMetadata.mobilePushTokens` (provider "fcm"), the same shape the
// iOS side uses for APNs. Zero external deps: an RS256 service-account JWT
// signed with node:crypto, exchanged for an OAuth2 access token, then plain
// HTTPS POSTs to the v1 endpoint.
//
// WHY this exists: hasta 2026-07-29 el servidor solo sabía hablar APNs
// (`pushRecipients` descartaba todo token cuyo provider no fuera "apns"),
// así que Android no podía recibir push aunque el device registrara bien.
//
// Required env (all must be set for sending; otherwise isFcmConfigured()
// is false and callers should surface "not configured" instead of trying).
// Los tres salen del JSON de una service account de Firebase con el rol
// "Firebase Cloud Messaging API Admin":
//   FCM_PROJECT_ID    ; project_id del JSON (p. ej. "digital-polyglot")
//   FCM_CLIENT_EMAIL  ; client_email del JSON (…@….iam.gserviceaccount.com)
//   FCM_PRIVATE_KEY   ; private_key del JSON (PEM). Literal "\n" allowed.

import { createPrivateKey, sign as cryptoSign } from "node:crypto";

export type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type FcmSendResult = {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
};

export function getFcmConfig(): FcmConfig | null {
  const projectId = process.env.FCM_PROJECT_ID?.trim();
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FCM_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) return null;
  // Allow the PEM to be stored with escaped newlines (common in env UIs).
  const privateKey = privateKeyRaw.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;
  return { projectId, clientEmail, privateKey };
}

export function isFcmConfigured(): boolean {
  return getFcmConfig() !== null;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

// Google's access tokens last 1h. Cache and reuse for ~50 min, same
// margin as the APNs provider JWT.
let cachedAccessToken: {
  token: string;
  createdAtMs: number;
  clientEmail: string;
} | null = null;

async function getAccessToken(config: FcmConfig, nowMs: number): Promise<string> {
  if (
    cachedAccessToken &&
    cachedAccessToken.clientEmail === config.clientEmail &&
    nowMs - cachedAccessToken.createdAtMs < 50 * 60 * 1000
  ) {
    return cachedAccessToken.token;
  }

  const iat = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const privateKey = createPrivateKey({ key: config.privateKey, format: "pem" });
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`FCM auth failed (${res.status}): ${raw.slice(0, 300)}`);
  }

  let accessToken = "";
  try {
    accessToken = (JSON.parse(raw) as { access_token?: string }).access_token ?? "";
  } catch {
    throw new Error(`FCM auth returned non-JSON: ${raw.slice(0, 200)}`);
  }
  if (!accessToken) throw new Error("FCM auth returned no access_token.");

  cachedAccessToken = {
    token: accessToken,
    createdAtMs: nowMs,
    clientEmail: config.clientEmail,
  };
  return accessToken;
}

export type FcmPayload = {
  title: string;
  body: string;
  /** Extra key/values merged into the message `data` (e.g. routing). */
  data?: Record<string, unknown>;
};

// FCM v1 rejects a `data` map with non-string values, unlike APNs, which
// takes the payload as-is. Coerce here so callers can pass the same object
// to both senders.
function toStringMap(data: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

/**
 * Send one alert to many device tokens.
 * Never throws on a per-token failure; each token gets its own result.
 * Throws only if FCM is not configured (guard with isFcmConfigured()).
 */
export async function sendFcmPush(
  tokens: string[],
  payload: FcmPayload,
): Promise<FcmSendResult[]> {
  const config = getFcmConfig();
  if (!config) throw new Error("FCM is not configured");
  if (tokens.length === 0) return [];

  const accessToken = await getAccessToken(config, Date.now());
  const endpoint = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;
  const data = toStringMap(payload.data);

  const results: FcmSendResult[] = [];
  // Bound concurrency so a large send doesn't open hundreds of sockets.
  // v1 has no multicast endpoint: one HTTP request per token.
  const CONCURRENCY = 20;
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tokens.length) {
      const token = tokens[index++];
      results.push(await sendOne(endpoint, accessToken, token, payload, data));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tokens.length) }, () => worker()),
  );

  return results;
}

async function sendOne(
  endpoint: string,
  accessToken: string,
  token: string,
  payload: FcmPayload,
  data: Record<string, string>,
): Promise<FcmSendResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          ...(Object.keys(data).length > 0 ? { data } : {}),
          android: {
            // "high" so the notification wakes a dozing device instead of
            // being batched until the next maintenance window.
            priority: "high",
            notification: { sound: "default" },
          },
        },
      }),
    });

    const raw = await res.text();
    if (res.ok) return { token, ok: true, status: res.status };

    // v1 errors look like { error: { status, message, details:[…] } }.
    // Surface `status` (UNREGISTERED / INVALID_ARGUMENT / …) so a stale
    // token is distinguishable from an auth or config problem, mirroring
    // the APNs `reason` field.
    let reason: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { error?: { status?: string; message?: string } };
      reason = parsed.error?.status ?? parsed.error?.message;
    } catch {
      reason = raw.slice(0, 200);
    }
    return { token, ok: false, status: res.status, reason };
  } catch (err) {
    return {
      token,
      ok: false,
      status: 0,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
