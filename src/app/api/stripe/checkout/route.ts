import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { STRIPE_PREMIUM_ANNUAL_PRICE_ID } from "@domain/billingCatalog";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// No usar Edge runtime (Clerk falla con auth en Edge)
export const runtime = "nodejs";

type AuthReturn = {
  userId: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json();
    const priceId =
      typeof body === "object" && body !== null && "priceId" in body
        ? (body as { priceId: unknown }).priceId
        : null;

    if (typeof priceId !== "string") {
      return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
    }

    const launchCoupon = process.env.STRIPE_LAUNCH_COUPON_ID?.trim();
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          clerkUserId: userId,
          checkoutType: "trial_with_pm",
          priceId,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/plans`,
    };

    // Launch promo (plan B): first-year discount applied ONLY to the annual plan.
    // Inert until STRIPE_LAUNCH_COUPON_ID is set. Coupon must be: amount_off €60,00
    // (6000), currency eur, duration "once" → first invoice €89, renews at €149.
    if (launchCoupon && priceId === STRIPE_PREMIUM_ANNUAL_PRICE_ID) {
      sessionParams.discounts = [{ coupon: launchCoupon }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Internal business events for funnel visibility
    await prisma.userMetric.createMany({
      data: [
        {
          userId,
          storySlug: "__plans__",
          bookSlug: "billing",
          eventType: "trial_started",
          value: 14,
        },
        {
          userId,
          storySlug: "__plans__",
          bookSlug: "billing",
          eventType: "trial_started_with_pm",
          value: 14,
        },
      ],
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("STRIPE ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
