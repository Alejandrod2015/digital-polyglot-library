// Minimal token-based APNs (Apple Push Notification service) sender.
//
// Reuses the native APNs device tokens already stored in Clerk
// `privateMetadata.mobilePushTokens` (provider "apns"), so no mobile
// rebuild is needed. Zero external deps: HTTP/2 via node:http2 and an
// ES256 provider JWT signed with node:crypto.
//
// Required env (all must be set for sending; otherwise isApnsConfigured()
// is false and callers should surface "not configured" instead of trying):
//   APNS_KEY_ID     ; the 10-char Key ID of the .p8 APNs auth key
//   APNS_TEAM_ID    ; Apple Developer Team ID (10 chars)
//   APNS_AUTH_KEY   ; contents of the .p8 file (PEM). Literal "\n" allowed.
//   APNS_BUNDLE_ID  ; the app bundle id (apns-topic)
//   APNS_PRODUCTION ; "1"/"true" → api.push.apple.com, else sandbox

import http2 from "node:http2";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  authKey: string;
  bundleId: string;
  production: boolean;
};

export type ApnsSendResult = {
  token: string;
  ok: boolean;
  status: number;
  reason?: string;
};

export function getApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const authKeyRaw = process.env.APNS_AUTH_KEY;
  const bundleId = process.env.APNS_BUNDLE_ID?.trim();
  if (!keyId || !teamId || !authKeyRaw || !bundleId) return null;
  // Allow the PEM to be stored with escaped newlines (common in env UIs).
  const authKey = authKeyRaw.includes("\\n") ? authKeyRaw.replace(/\\n/g, "\n") : authKeyRaw;
  const production = /^(1|true|yes)$/i.test(process.env.APNS_PRODUCTION?.trim() ?? "");
  return { keyId, teamId, authKey, bundleId, production };
}

export function isApnsConfigured(): boolean {
  return getApnsConfig() !== null;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Provider JWTs are valid up to 60 min; Apple rejects tokens older than
// that and rate-limits frequent regeneration. Cache and reuse for ~50 min.
let cachedJwt: { token: string; createdAtMs: number; keyId: string } | null = null;

function buildProviderJwt(config: ApnsConfig, nowMs: number): string {
  if (
    cachedJwt &&
    cachedJwt.keyId === config.keyId &&
    nowMs - cachedJwt.createdAtMs < 50 * 60 * 1000
  ) {
    return cachedJwt.token;
  }
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const claims = base64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(nowMs / 1000) }),
  );
  const signingInput = `${header}.${claims}`;
  const privateKey = createPrivateKey({ key: config.authKey, format: "pem" });
  // ES256 JOSE signatures are raw r||s (P1363), not DER.
  const signature = cryptoSign("SHA256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const token = `${signingInput}.${base64url(signature)}`;
  cachedJwt = { token, createdAtMs: nowMs, keyId: config.keyId };
  return token;
}

export type ApnsPayload = {
  title: string;
  body: string;
  /** Extra key/values merged into the notification payload (e.g. routing). */
  data?: Record<string, unknown>;
};

/**
 * Send one alert to many device tokens over a single HTTP/2 connection.
 * Never throws on a per-token failure; each token gets its own result.
 * Throws only if APNs is not configured (guard with isApnsConfigured()).
 */
export async function sendApnsPush(
  tokens: string[],
  payload: ApnsPayload,
): Promise<ApnsSendResult[]> {
  const config = getApnsConfig();
  if (!config) throw new Error("APNs is not configured");
  if (tokens.length === 0) return [];

  const jwt = buildProviderJwt(config, Date.now());
  const bodyJson = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...(payload.data ?? {}),
  });

  const PROD_HOST = "https://api.push.apple.com";
  const SANDBOX_HOST = "https://api.sandbox.push.apple.com";
  const primary = config.production ? PROD_HOST : SANDBOX_HOST;
  const secondary = config.production ? SANDBOX_HOST : PROD_HOST;

  let results = await sendBatch(primary, tokens, jwt, config, bodyJson);

  // A locally-signed (development) build registers a SANDBOX token even
  // when built Release, while TestFlight/App Store builds register
  // PRODUCTION tokens; and the token itself doesn't reveal which. So if a
  // token is rejected as BadDeviceToken on the primary host, retry it on
  // the other environment. One deploy then serves both, without flipping
  // APNS_PRODUCTION by hand.
  const mismatched = results.filter(
    (r) => !r.ok && (r.reason === "BadDeviceToken" || r.status === 400),
  );
  if (mismatched.length > 0) {
    const retried = await sendBatch(
      secondary,
      mismatched.map((r) => r.token),
      jwt,
      config,
      bodyJson,
    );
    const byToken = new Map(retried.map((r) => [r.token, r]));
    results = results.map((r) => byToken.get(r.token) ?? r);
  }

  return results;
}

async function sendBatch(
  host: string,
  tokens: string[],
  jwt: string,
  config: ApnsConfig,
  bodyJson: string,
): Promise<ApnsSendResult[]> {
  if (tokens.length === 0) return [];
  const client = http2.connect(host);
  const results: ApnsSendResult[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      client.on("error", reject);
      client.on("connect", () => resolve());
    });

    // Bound concurrency so a large send doesn't open thousands of streams.
    const CONCURRENCY = 20;
    let index = 0;

    async function worker(): Promise<void> {
      while (index < tokens.length) {
        const token = tokens[index++];
        results.push(await sendOne(client, token, jwt, config, bodyJson));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, tokens.length) }, () => worker()),
    );
  } finally {
    client.close();
  }

  return results;
}

function sendOne(
  client: http2.ClientHttp2Session,
  token: string,
  jwt: string,
  config: ApnsConfig,
  bodyJson: string,
): Promise<ApnsSendResult> {
  return new Promise<ApnsSendResult>((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });

    let status = 0;
    let raw = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      let reason: string | undefined;
      if (status !== 200 && raw) {
        try {
          reason = (JSON.parse(raw) as { reason?: string }).reason;
        } catch {
          reason = raw.slice(0, 200);
        }
      }
      resolve({ token, ok: status === 200, status, reason });
    });
    req.on("error", (err) => {
      resolve({ token, ok: false, status: 0, reason: err.message });
    });
    req.end(bodyJson);
  });
}
