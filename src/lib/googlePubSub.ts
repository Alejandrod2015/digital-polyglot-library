import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verify the OIDC bearer token that Google Cloud Pub/Sub attaches to an
 * authenticated push request. Without this, the Play RTDN endpoint would accept
 * any POST from anyone. Google signs the token; we verify it against Google's
 * public JWKS and check issuer + audience (and optionally the service-account
 * email), which is the standard way to authenticate Pub/Sub push.
 *
 * Fail-closed: if GOOGLE_PLAY_PUBSUB_AUDIENCE is unset, this throws, so the
 * endpoint rejects everything until the push subscription is configured with
 * OIDC auth. See docs/play-store-launch.md.
 */

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export async function verifyPubSubOidcToken(authorizationHeader: string | null): Promise<void> {
  const audience = process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE?.trim();
  if (!audience) {
    throw new Error(
      "Pub/Sub auth not configured. Set GOOGLE_PLAY_PUBSUB_AUDIENCE and configure the push subscription with OIDC."
    );
  }

  const token =
    authorizationHeader && authorizationHeader.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length).trim()
      : "";
  if (!token) {
    throw new Error("Missing Pub/Sub OIDC bearer token.");
  }

  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });

  // Optional but recommended: pin the caller to the exact service account that
  // owns the push subscription.
  const expectedEmail = process.env.GOOGLE_PLAY_PUBSUB_SA_EMAIL?.trim();
  if (expectedEmail) {
    const email = typeof payload.email === "string" ? payload.email : "";
    if (email !== expectedEmail || payload.email_verified !== true) {
      throw new Error("Pub/Sub OIDC token email does not match the configured service account.");
    }
  }
}
