import type { BillingEntitlement } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";
import { verifyGooglePlaySubscriptionPurchase } from "@/lib/googlePlay";

/**
 * Verify a Google Play purchase token against the Android Publisher API, upsert
 * the user's `BillingEntitlement` (source `google_play`) and push the resulting
 * plan to Clerk. Shared by the web (Clerk-auth) and mobile (session-auth) verify
 * routes so the persistence logic lives in one place, mirroring
 * `applyAppleVerifiedTransaction`.
 */
export async function applyGooglePlayVerifiedPurchase(
  userId: string,
  purchaseToken: string
): Promise<BillingEntitlement> {
  const verified = await verifyGooglePlaySubscriptionPurchase(purchaseToken);

  const shared = {
    plan: verified.plan,
    source: "google_play" as const,
    status: verified.status,
    productId: verified.productId,
    purchaseToken: verified.purchaseToken,
    orderId: verified.orderId,
    willRenew: verified.willRenew,
    expiresAt: verified.expiresAt,
    rawPayload: verified.rawPayload,
  };

  const entitlement = await prisma.billingEntitlement.upsert({
    where: { userId },
    create: {
      userId,
      startedAt: verified.startedAt ?? new Date(),
      renewedAt: new Date(),
      ...shared,
    },
    update: {
      renewedAt: new Date(),
      ...shared,
    },
  });

  await syncClerkPlanFromEntitlement(userId, entitlement);
  return entitlement;
}
