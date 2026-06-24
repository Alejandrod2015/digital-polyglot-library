import type { BillingEntitlement } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";
import { verifyAppleSignedTransaction } from "@/lib/appStore";

/**
 * Verify an Apple StoreKit 2 signed transaction, upsert the user's
 * `BillingEntitlement` (source `app_store`) and push the resulting plan to
 * Clerk. Shared by the web (Clerk-auth) and mobile (session-auth) verify
 * routes so the persistence logic lives in one place.
 */
export async function applyAppleVerifiedTransaction(
  userId: string,
  signedTransactionInfo: string
): Promise<BillingEntitlement> {
  const verified = await verifyAppleSignedTransaction(signedTransactionInfo);

  const shared = {
    plan: verified.plan,
    source: "app_store" as const,
    status: verified.status,
    productId: verified.productId,
    purchaseToken: verified.originalTransactionId,
    orderId: verified.transactionId,
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
