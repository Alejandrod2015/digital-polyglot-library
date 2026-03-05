import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
    const customerId = user.privateMetadata?.stripeCustomerId;

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account." },
        { status: 400 }
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
