import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import type { BillingEntitlement } from "@/generated/prisma";
import { getEffectivePlanFromEntitlement } from "@/lib/billing";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// `owner` is the internal tier. It is set by hand in Clerk and never derived
// from a BillingEntitlement row, so every sync below would silently demote an
// owner account to whatever Stripe/App Store/Play last reported. The mobile app
// gates its internal tools (Test mode reset, Replay tour) on plan === "owner",
// so losing the tag makes those disappear with no visible cause. Keep it sticky:
// billing may update trial/source fields on an owner, never the plan itself.
async function keepOwnerPlan<T extends string>(
  userId: string,
  nextPlan: T
): Promise<T | "owner"> {
  try {
    const user = await clerkClient.users.getUser(userId);
    if (user.publicMetadata?.plan === "owner") return "owner";
  } catch {
    // A Clerk read failure must not block the billing sync; fall back to the
    // plan the entitlement says.
  }
  return nextPlan;
}

export async function syncClerkPlanFromEntitlement(
  userId: string,
  entitlement: BillingEntitlement | null
) {
  const effectivePlan = await keepOwnerPlan(
    userId,
    getEffectivePlanFromEntitlement(entitlement) ?? "free"
  );
  const trialStartedAt =
    entitlement?.source === "stripe" ? entitlement.startedAt?.toISOString() ?? null : null;

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan: effectivePlan,
      trialStartedAt,
      trialEndsAt: entitlement?.trialEndsAt?.toISOString() ?? null,
      trialStatus: entitlement?.status ?? null,
      billingSource: entitlement?.source ?? null,
      billingProductId: entitlement?.productId ?? null,
    },
    privateMetadata: {
      stripeCustomerId: entitlement?.externalCustomerId ?? null,
      stripeSubscriptionId: entitlement?.source === "stripe"
        ? entitlement?.externalSubscriptionId ?? null
        : null,
      googlePlayPurchaseToken: entitlement?.source === "google_play"
        ? entitlement?.purchaseToken ?? null
        : null,
      appStoreOriginalTransactionId: entitlement?.source === "app_store"
        ? entitlement?.purchaseToken ?? null
        : null,
    },
  });
}

export async function syncClerkStripeSubscription(args: {
  userId: string;
  plan: "premium" | "polyglot";
  subscription: Stripe.Subscription;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const { userId, plan, subscription, stripeCustomerId, stripeSubscriptionId } = args;
  const nextPlan = await keepOwnerPlan(userId, plan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan: nextPlan,
      trialStartedAt: new Date(
        (subscription.start_date ?? Math.floor(Date.now() / 1000)) * 1000
      ).toISOString(),
      trialEndsAt:
        typeof subscription.trial_end === "number"
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      trialStatus:
        subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "canceled"
            ? "canceled"
            : "active",
      billingSource: "stripe",
      billingProductId: subscription.items.data[0]?.price.id ?? null,
    },
    privateMetadata: {
      stripeCustomerId: stripeCustomerId ?? null,
      stripeSubscriptionId: stripeSubscriptionId ?? subscription.id,
      googlePlayPurchaseToken: null,
    },
  });
}

export async function syncClerkStripeCancellation(args: {
  userId: string;
  plan: "premium" | "polyglot";
  subscription: Stripe.Subscription;
}) {
  const { userId, plan, subscription } = args;
  const nextPlan = await keepOwnerPlan(userId, plan);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan: nextPlan,
      trialStartedAt: new Date(
        (subscription.start_date ?? Math.floor(Date.now() / 1000)) * 1000
      ).toISOString(),
      trialEndsAt:
        typeof subscription.trial_end === "number"
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      trialStatus: "canceled",
      billingSource: "stripe",
      billingProductId: subscription.items.data[0]?.price.id ?? null,
    },
    privateMetadata: {
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : null,
      stripeSubscriptionId: subscription.id,
      googlePlayPurchaseToken: null,
    },
  });
}
