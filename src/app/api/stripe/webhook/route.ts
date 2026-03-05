import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

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

        let plan: "premium" | "polyglot" | null = null;
        if (priceId === "price_1SI5WW6ytrKVzptQW7CBTx2G") plan = "premium";
        if (priceId === "price_1SI5Wv6ytrKVzptQkzfg7emI") plan = "polyglot";
        // Current active price IDs in plans page
        if (priceId === "price_1SbP7r6ytrKVzptQaTBIuAaZ") plan = "premium";
        if (priceId === "price_1SbP9H6ytrKVzptQQTz9v1hd") plan = "premium";

        if (plan) {
          const trialEndIso =
            typeof subscription.trial_end === "number"
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null;
          await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
              plan,
              trialStartedAt: new Date().toISOString(),
              trialEndsAt: trialEndIso,
              trialStatus: subscription.status === "trialing" ? "trialing" : "active",
            },
          });
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

        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: {
            trialEndsAt: trialEndIso,
            trialStatus:
              subscription.status === "trialing"
                ? "trialing"
                : subscription.status === "canceled"
                  ? "canceled"
                  : "active",
          },
        });
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
        await clerkClient.users.updateUserMetadata(userId, {
          publicMetadata: { trialStatus: "canceled" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
