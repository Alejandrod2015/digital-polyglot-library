import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import type { BillingEntitlement } from "@/generated/prisma";
import { getEffectivePlanFromEntitlement } from "@/lib/billing";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function syncClerkPlanFromEntitlement(
  userId: string,
  entitlement: BillingEntitlement | null
) {
  const effectivePlan = getEffectivePlanFromEntitlement(entitlement);
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

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan,
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

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      plan,
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
