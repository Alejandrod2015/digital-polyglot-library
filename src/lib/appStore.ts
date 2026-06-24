import { X509Certificate } from "crypto";
import { compactVerify } from "jose";
import { resolvePlanFromAppStoreProductId, type PaidPlan } from "@/lib/billing";

/**
 * Apple In-App Purchase (StoreKit 2 + App Store Server Notifications v2)
 * verification. Mirrors `src/lib/googlePlay.ts`: takes the signed payload
 * Apple gives us, verifies it cryptographically, and returns a normalized
 * subscription shape the billing routes upsert into `BillingEntitlement`.
 *
 * Apple signs every transaction / notification as a JWS whose protected
 * header carries the full x5c certificate chain (leaf -> intermediate ->
 * Apple Root CA - G3). We verify the chain, pin the root, then verify the
 * JWS signature with the leaf's public key. No third-party SDK needed.
 */

// SHA-256 fingerprint of "Apple Root CA - G3" (the root that anchors every
// StoreKit JWS). Pinned so a forged chain with an attacker-controlled root is
// rejected. If Apple ever rotates this, verification fails CLOSED (rejects),
// never open. Confirm against https://www.apple.com/certificateauthority/ .
const APPLE_ROOT_CA_G3_FINGERPRINT_SHA256 =
  "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";

type BillingStatusName =
  | "active"
  | "trialing"
  | "in_grace_period"
  | "on_hold"
  | "paused"
  | "canceled"
  | "expired"
  | "pending"
  | "revoked"
  | "unknown";

/** Decoded JWSTransaction payload (subset we use). */
export type AppleTransactionPayload = {
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: number; // ms epoch
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  type?: string; // "Auto-Renewable Subscription"
  inAppOwnershipType?: string;
  offerType?: number; // 1 = intro (often free trial)
  environment?: string; // "Sandbox" | "Production"
  bundleId?: string;
};

/** Decoded JWSRenewalInfo payload (subset we use). */
export type AppleRenewalInfoPayload = {
  autoRenewStatus?: number; // 1 = will renew, 0 = off
  autoRenewProductId?: string;
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  productId?: string;
  environment?: string;
};

/** Decoded responseBodyV2 (App Store Server Notification v2). */
export type AppleNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    bundleId?: string;
    environment?: string;
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
};

export type VerifiedAppleSubscription = {
  plan: PaidPlan;
  productId: string;
  /** originalTransactionId — stable across renewals, used as purchaseToken. */
  originalTransactionId: string;
  transactionId: string;
  status: BillingStatusName;
  willRenew: boolean;
  startedAt: Date | null;
  expiresAt: Date | null;
  environment: string | null;
  rawPayload: AppleTransactionPayload;
};

function pemFromDerBase64(derBase64: string): string {
  const body = derBase64.replace(/(.{64})/g, "$1\n");
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

function decodeProtectedHeader(jws: string): { x5c?: string[]; alg?: string } {
  const protectedSegment = jws.split(".")[0];
  if (!protectedSegment) throw new Error("Malformed Apple JWS: missing header.");
  const json = Buffer.from(protectedSegment, "base64url").toString("utf8");
  return JSON.parse(json) as { x5c?: string[]; alg?: string };
}

/**
 * Verify an Apple-signed JWS (transaction, renewal info, or notification body)
 * and return its decoded payload. Throws if the certificate chain, root pin,
 * cert validity, or signature fails.
 */
export async function verifyAppleJws<T>(
  jws: string,
  // Overridable only so tests can pin a self-generated root; production callers
  // always use Apple Root CA - G3.
  expectedRootFingerprintSha256: string = APPLE_ROOT_CA_G3_FINGERPRINT_SHA256
): Promise<T> {
  const header = decodeProtectedHeader(jws);
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 3) {
    throw new Error("Apple JWS missing x5c certificate chain.");
  }

  const certs = x5c.map((der) => new X509Certificate(Buffer.from(der, "base64")));
  const leaf = certs[0];
  const intermediate = certs[1];
  const root = certs[certs.length - 1];

  // Pin the root: its SHA-256 fingerprint must equal Apple Root CA - G3.
  const rootFingerprint = root.fingerprint256.replace(/:/g, "").toLowerCase();
  if (rootFingerprint !== expectedRootFingerprintSha256) {
    throw new Error("Apple JWS root certificate is not Apple Root CA - G3.");
  }

  // Verify the chain: each cert signed by the next one up.
  if (!leaf.verify(intermediate.publicKey)) {
    throw new Error("Apple JWS leaf certificate not signed by intermediate.");
  }
  if (!intermediate.verify(root.publicKey)) {
    throw new Error("Apple JWS intermediate certificate not signed by root.");
  }

  // Validity window of the signing (leaf) certificate.
  const now = Date.now();
  if (now < Date.parse(leaf.validFrom) || now > Date.parse(leaf.validTo)) {
    throw new Error("Apple JWS leaf certificate is expired or not yet valid.");
  }

  // Signature check with the leaf public key.
  const { payload } = await compactVerify(jws, leaf.publicKey);
  return JSON.parse(new TextDecoder().decode(payload)) as T;
}

function deriveStatusFromTransaction(tx: AppleTransactionPayload): BillingStatusName {
  if (tx.revocationDate) return "revoked";
  if (tx.expiresDate && tx.expiresDate <= Date.now()) return "expired";
  if (tx.offerType === 1) return "trialing";
  return "active";
}

function toVerifiedSubscription(
  tx: AppleTransactionPayload,
  opts?: { status?: BillingStatusName; willRenew?: boolean }
): VerifiedAppleSubscription {
  const productId = tx.productId ?? "";
  const plan = resolvePlanFromAppStoreProductId(productId);
  if (!plan) {
    throw new Error(`Unknown App Store productId: ${productId || "missing"}`);
  }
  const originalTransactionId = tx.originalTransactionId ?? tx.transactionId ?? "";
  if (!originalTransactionId) {
    throw new Error("App Store transaction missing originalTransactionId.");
  }
  return {
    plan,
    productId,
    originalTransactionId,
    transactionId: tx.transactionId ?? originalTransactionId,
    status: opts?.status ?? deriveStatusFromTransaction(tx),
    willRenew: opts?.willRenew ?? Boolean(tx.expiresDate && tx.expiresDate > Date.now()),
    startedAt: tx.originalPurchaseDate
      ? new Date(tx.originalPurchaseDate)
      : tx.purchaseDate
        ? new Date(tx.purchaseDate)
        : null,
    expiresAt: tx.expiresDate ? new Date(tx.expiresDate) : null,
    environment: tx.environment ?? null,
    rawPayload: tx,
  };
}

/**
 * Verify a signed transaction (StoreKit 2 `jwsRepresentation`) sent by the
 * client right after a purchase/restore, and normalize it.
 */
export async function verifyAppleSignedTransaction(
  signedTransactionInfo: string
): Promise<VerifiedAppleSubscription> {
  const tx = await verifyAppleJws<AppleTransactionPayload>(signedTransactionInfo);
  return toVerifiedSubscription(tx);
}

function mapNotificationToStatus(
  notificationType: string | undefined,
  subtype: string | undefined,
  tx: AppleTransactionPayload
): BillingStatusName {
  switch (notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "OFFER_REDEEMED":
    case "RENEWAL_EXTENDED":
    case "DID_CHANGE_RENEWAL_PREF":
      return deriveStatusFromTransaction(tx);
    case "DID_CHANGE_RENEWAL_STATUS":
      // Status itself unchanged; willRenew is handled from renewal info.
      return deriveStatusFromTransaction(tx);
    case "DID_FAIL_TO_RENEW":
      return subtype === "GRACE_PERIOD" ? "in_grace_period" : "on_hold";
    case "GRACE_PERIOD_EXPIRED":
    case "EXPIRED":
      return "expired";
    case "REFUND":
    case "REVOKE":
      return "revoked";
    default:
      return deriveStatusFromTransaction(tx);
  }
}

export type DecodedAppleNotification = {
  notificationType: string;
  subtype: string | null;
  notificationUUID: string | null;
  environment: string | null;
  subscription: VerifiedAppleSubscription | null;
};

/**
 * Verify + decode an App Store Server Notification v2 (`{ signedPayload }`).
 * Returns the notification metadata plus the normalized subscription (when the
 * notification carries transaction info for a product we sell).
 */
export async function decodeAppleNotification(
  signedPayload: string
): Promise<DecodedAppleNotification> {
  const body = await verifyAppleJws<AppleNotificationPayload>(signedPayload);
  const notificationType = body.notificationType ?? "";
  const subtype = body.subtype ?? null;

  let subscription: VerifiedAppleSubscription | null = null;
  const signedTx = body.data?.signedTransactionInfo;
  if (signedTx) {
    const tx = await verifyAppleJws<AppleTransactionPayload>(signedTx);

    let willRenew: boolean | undefined;
    const signedRenewal = body.data?.signedRenewalInfo;
    if (signedRenewal) {
      const renewal = await verifyAppleJws<AppleRenewalInfoPayload>(signedRenewal);
      willRenew = renewal.autoRenewStatus === 1;
    }
    if (notificationType === "DID_CHANGE_RENEWAL_STATUS") {
      willRenew = subtype !== "AUTO_RENEW_DISABLED";
    }

    // Only normalize if it maps to a plan we sell; otherwise leave null so the
    // route can ignore the notification gracefully.
    if (resolvePlanFromAppStoreProductId(tx.productId)) {
      subscription = toVerifiedSubscription(tx, {
        status: mapNotificationToStatus(notificationType, subtype ?? undefined, tx),
        willRenew,
      });
    }
  }

  return {
    notificationType,
    subtype,
    notificationUUID: body.notificationUUID ?? null,
    environment: body.data?.environment ?? null,
    subscription,
  };
}
