import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export const runtime = "nodejs";

function isMissingBillingEntitlementsTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    const mobileSession = !clerkUserId ? await getMobileSessionFromRequest(request) : null;
    const userId = clerkUserId ?? mobileSession?.sub ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    const privateMetadata = user.privateMetadata as Record<string, unknown> | undefined;
    const plan = user.publicMetadata?.plan;
    let entitlement: { source: "stripe" | "google_play" } | null = null;
    try {
      entitlement = await prisma.billingEntitlement.findUnique({
        where: { userId },
        select: { source: true },
      });
    } catch (error) {
      if (!isMissingBillingEntitlementsTableError(error)) {
        throw error;
      }
    }
    const email = user.emailAddresses[0]?.emailAddress;
    const privateCustomerId = privateMetadata?.stripeCustomerId;
    const privateSubscriptionId = privateMetadata?.stripeSubscriptionId;

    if (entitlement?.source === "google_play") {
      return NextResponse.json(
        {
          error: "This subscription is managed in Google Play.",
        },
        { status: 409 }
      );
    }

    let customerId =
      typeof privateCustomerId === "string" && privateCustomerId.trim().length > 0
        ? privateCustomerId
        : null;

    if (!customerId && typeof privateSubscriptionId === "string" && privateSubscriptionId.trim()) {
      try {
        const subscription = await stripe.subscriptions.retrieve(privateSubscriptionId);
        customerId =
          typeof subscription.customer === "string" && subscription.customer.trim().length > 0
            ? subscription.customer
            : null;
      } catch (err) {
        console.warn("STRIPE PORTAL: failed to recover customer from subscription", err);
      }
    }

    if (!customerId && email) {
      try {
        const customers = await stripe.customers.list({ email, limit: 1 });
        customerId = customers.data[0]?.id ?? null;
      } catch (err) {
        console.warn("STRIPE PORTAL: failed to recover customer from email", err);
      }
    }

    if (customerId && customerId !== privateCustomerId) {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...privateMetadata,
          stripeCustomerId: customerId,
        },
      });
    }

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      const isPaidPlan =
        plan === "premium" || plan === "polyglot" || plan === "owner";

      return NextResponse.json(
        isPaidPlan
          ? {
              error:
                "We couldn't find your Stripe billing record yet. Please contact support.",
            }
          : {
              error: "No active subscription found for this account.",
              fallbackUrl: "/plans",
            },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("STRIPE PORTAL ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
