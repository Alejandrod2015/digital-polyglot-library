import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Prisma } from "@/generated/prisma";
import { Prisma as PrismaNamespace } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { resolvePlanFromStripePriceId } from "@/lib/billing";
import {
  syncClerkPlanFromEntitlement,
  syncClerkStripeCancellation,
  syncClerkStripeSubscription,
} from "@/lib/billingClerk";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function getStripeSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");

  if (periodEnds.length === 0) {
    return null;
  }

  return new Date(Math.max(...periodEnds) * 1000);
}

function serializeStripeSubscriptionPayload(subscription: Stripe.Subscription): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(subscription)) as Prisma.InputJsonValue;
}

function isMissingBillingEntitlementsTableError(error: unknown) {
  return (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  try {
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const subscriptionId = session.subscription as string | undefined;

      if (userId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = resolvePlanFromStripePriceId(priceId);

        if (plan) {
          const stripeCustomerId =
            typeof session.customer === "string" ? session.customer : null;
          try {
            const entitlement = await prisma.billingEntitlement.upsert({
              where: { userId },
              create: {
                userId,
                plan,
                source: "stripe",
                status: subscription.status === "trialing" ? "trialing" : "active",
                productId: priceId ?? null,
                externalCustomerId: stripeCustomerId,
                externalSubscriptionId: subscriptionId,
                willRenew: !subscription.cancel_at_period_end,
                startedAt: new Date((subscription.start_date ?? Math.floor(Date.now() / 1000)) * 1000),
                renewedAt: new Date(),
                trialEndsAt:
                  typeof subscription.trial_end === "number"
                    ? new Date(subscription.trial_end * 1000)
                    : null,
                expiresAt: getStripeSubscriptionPeriodEnd(subscription),
                rawPayload: serializeStripeSubscriptionPayload(subscription),
              },
              update: {
                plan,
                source: "stripe",
                status: subscription.status === "trialing" ? "trialing" : "active",
                productId: priceId ?? null,
                externalCustomerId: stripeCustomerId,
                externalSubscriptionId: subscriptionId,
                willRenew: !subscription.cancel_at_period_end,
                renewedAt: new Date(),
                trialEndsAt:
                  typeof subscription.trial_end === "number"
                    ? new Date(subscription.trial_end * 1000)
                    : null,
                expiresAt: getStripeSubscriptionPeriodEnd(subscription),
                rawPayload: serializeStripeSubscriptionPayload(subscription),
              },
            });
            await syncClerkPlanFromEntitlement(userId, entitlement);
          } catch (error) {
            if (!isMissingBillingEntitlementsTableError(error)) {
              throw error;
            }

            await syncClerkStripeSubscription({
              userId,
              plan,
              subscription,
              stripeCustomerId,
              stripeSubscriptionId: subscriptionId,
            });
          }
          console.log(`✅ Updated user ${userId} to plan: ${plan}`);
        } else {
          console.warn("⚠️ Unknown priceId:", priceId);
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata ?? {};
      const userId = metadata.clerkUserId;
      if (userId) {
        const eventAny = event as Stripe.Event & {
          data: { previous_attributes?: Record<string, unknown> };
        };
        const previousStatus = eventAny.data.previous_attributes?.status;

        const trialEndIso =
          typeof subscription.trial_end === "number"
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null;

        if (previousStatus === "trialing" && subscription.status === "active") {
          await prisma.userMetric.create({
            data: {
              userId,
              storySlug: "__plans__",
              bookSlug: "billing",
              eventType: "trial_converted",
              value: 1,
            },
          });
        }

        if (subscription.cancel_at_period_end || subscription.status === "canceled") {
          await prisma.userMetric.create({
            data: {
              userId,
              storySlug: "__plans__",
              bookSlug: "billing",
              eventType: "trial_canceled",
              value: 1,
            },
          });
        }

        const plan = resolvePlanFromStripePriceId(subscription.items.data[0]?.price.id);
        const resolvedPlan = plan ?? "premium";
        try {
          const entitlement = await prisma.billingEntitlement.upsert({
            where: { userId },
            create: {
              userId,
              plan: resolvedPlan,
              source: "stripe",
              status:
                subscription.status === "trialing"
                  ? "trialing"
                  : subscription.status === "canceled"
                    ? "canceled"
                    : "active",
              productId: subscription.items.data[0]?.price.id ?? null,
              externalCustomerId:
                typeof subscription.customer === "string" ? subscription.customer : null,
              externalSubscriptionId: subscription.id,
              willRenew: !subscription.cancel_at_period_end,
              startedAt: new Date((subscription.start_date ?? Math.floor(Date.now() / 1000)) * 1000),
              renewedAt: new Date(),
              trialEndsAt: trialEndIso ? new Date(trialEndIso) : null,
              expiresAt: getStripeSubscriptionPeriodEnd(subscription),
              rawPayload: serializeStripeSubscriptionPayload(subscription),
            },
            update: {
              ...(plan ? { plan } : {}),
              status:
                subscription.status === "trialing"
                  ? "trialing"
                  : subscription.status === "canceled"
                    ? "canceled"
                    : "active",
              productId: subscription.items.data[0]?.price.id ?? null,
              externalCustomerId:
                typeof subscription.customer === "string" ? subscription.customer : null,
              externalSubscriptionId: subscription.id,
              willRenew: !subscription.cancel_at_period_end,
              renewedAt: new Date(),
              trialEndsAt: trialEndIso ? new Date(trialEndIso) : null,
              expiresAt: getStripeSubscriptionPeriodEnd(subscription),
              rawPayload: serializeStripeSubscriptionPayload(subscription),
            },
          });
          await syncClerkPlanFromEntitlement(userId, entitlement);
        } catch (error) {
          if (!isMissingBillingEntitlementsTableError(error)) {
            throw error;
          }

          await syncClerkStripeSubscription({
            userId,
            plan: resolvedPlan,
            subscription,
            stripeCustomerId:
              typeof subscription.customer === "string" ? subscription.customer : null,
            stripeSubscriptionId: subscription.id,
          });
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.clerkUserId;
      if (userId) {
        await prisma.userMetric.create({
          data: {
            userId,
            storySlug: "__plans__",
            bookSlug: "billing",
            eventType: "trial_canceled",
            value: 1,
          },
        });
        const resolvedPlan =
          resolvePlanFromStripePriceId(subscription.items.data[0]?.price.id) ?? "premium";
        try {
          const entitlement = await prisma.billingEntitlement.upsert({
            where: { userId },
            create: {
              userId,
              plan: resolvedPlan,
              source: "stripe",
              status: "canceled",
              productId: subscription.items.data[0]?.price.id ?? null,
              externalCustomerId:
                typeof subscription.customer === "string" ? subscription.customer : null,
              externalSubscriptionId: subscription.id,
              willRenew: false,
              startedAt: new Date((subscription.start_date ?? Math.floor(Date.now() / 1000)) * 1000),
              expiresAt: getStripeSubscriptionPeriodEnd(subscription),
              rawPayload: serializeStripeSubscriptionPayload(subscription),
            },
            update: {
              status: "canceled",
              willRenew: false,
              expiresAt: getStripeSubscriptionPeriodEnd(subscription),
              rawPayload: serializeStripeSubscriptionPayload(subscription),
            },
          });
          await syncClerkPlanFromEntitlement(userId, entitlement);
        } catch (error) {
          if (!isMissingBillingEntitlementsTableError(error)) {
            throw error;
          }

          await syncClerkStripeCancellation({
            userId,
            plan: resolvedPlan,
            subscription,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
