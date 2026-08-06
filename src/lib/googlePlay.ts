import { createSign } from "crypto";
import { resolvePlanFromGooglePlayProductId, type PaidPlan } from "@/lib/billing";

const GOOGLE_PLAY_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

type GoogleAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type GooglePlaySubscriptionLineItem = {
  productId?: string;
  expiryTime?: string;
  latestSuccessfulOrderId?: string;
  autoRenewingPlan?: {
    autoRenewEnabled?: boolean;
  };
};

type GooglePlaySubscriptionPurchaseV2 = {
  subscriptionState?: string;
  lineItems?: GooglePlaySubscriptionLineItem[];
  startTime?: string;
  acknowledgementState?: string;
};

export type VerifiedGooglePlaySubscription = {
  plan: PaidPlan;
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  status: "active" | "trialing" | "in_grace_period" | "on_hold" | "paused" | "canceled" | "expired" | "pending" | "revoked" | "unknown";
  willRenew: boolean;
  startedAt: Date | null;
  expiresAt: Date | null;
  rawPayload: GooglePlaySubscriptionPurchaseV2;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Reads the service-account JSON off disk. Local-only convenience, mirroring
 * `ASC_PRIVATE_KEY_PATH` on the Apple side: it means a private key does not
 * have to be pasted into `.env.local` just so a script can run. Vercel keeps
 * using the inline vars, and both service-account vars are stored there as
 * sensitive, which is why `vercel env pull` brings them back empty.
 */
function readGooglePlayKeyFile(): { clientEmail: string; privateKey: string } | null {
  const path = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (!path) return null;
  try {
    // Required lazily so the bundler never pulls `fs` into an edge or client
    // bundle for a path that only ever exists on a developer's machine.
    const { readFileSync } = require("fs") as typeof import("fs");
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) return null;
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    return null;
  }
}

export function getGooglePlayCredentials() {
  const fromFile = readGooglePlayKeyFile();
  const clientEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim() || fromFile?.clientEmail;
  const privateKey =
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n") || fromFile?.privateKey;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();

  if (!clientEmail || !privateKey || !packageName) {
    throw new Error(
      "Missing Google Play credentials. Set GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL, GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_FILE), and GOOGLE_PLAY_PACKAGE_NAME."
    );
  }

  return { clientEmail, privateKey, packageName };
}

export async function getGooglePlayAccessToken() {
  const { clientEmail, privateKey } = getGooglePlayCredentials();
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: GOOGLE_PLAY_SCOPE,
    aud: GOOGLE_PLAY_TOKEN_URL,
    exp: issuedAt + 3600,
    iat: issuedAt,
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  const signature = signer.sign(privateKey, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(GOOGLE_PLAY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google OAuth failed with status ${response.status}`);
  }

  return (await response.json()) as GoogleAccessTokenResponse;
}

function mapGooglePlaySubscriptionState(
  state: string | undefined
): VerifiedGooglePlaySubscription["status"] {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "in_grace_period";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "on_hold";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "canceled";
    case "SUBSCRIPTION_STATE_EXPIRED":
      return "expired";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

export async function verifyGooglePlaySubscriptionPurchase(
  purchaseToken: string
): Promise<VerifiedGooglePlaySubscription> {
  const { access_token: accessToken } = await getGooglePlayAccessToken();
  const { packageName } = getGooglePlayCredentials();

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Google Play verification failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GooglePlaySubscriptionPurchaseV2;
  const lineItem = payload.lineItems?.[0];
  const productId = lineItem?.productId ?? "";
  const plan = resolvePlanFromGooglePlayProductId(productId);

  if (!plan) {
    throw new Error(`Unknown Google Play productId: ${productId || "missing"}`);
  }

  return {
    plan,
    productId,
    purchaseToken,
    orderId: lineItem?.latestSuccessfulOrderId ?? null,
    status: mapGooglePlaySubscriptionState(payload.subscriptionState),
    willRenew: Boolean(lineItem?.autoRenewingPlan?.autoRenewEnabled),
    startedAt: payload.startTime ? new Date(payload.startTime) : null,
    expiresAt: lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null,
    rawPayload: payload,
  };
}
