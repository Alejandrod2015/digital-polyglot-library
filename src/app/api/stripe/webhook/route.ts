import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

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

        if (plan) {
          await (clerkClient as any).users.updateUser(userId, {
            publicMetadata: { plan }, // 👈 Usa el mismo campo existente
          });
          console.log(`✅ Updated user ${userId} to plan: ${plan}`);
        } else {
          console.warn("⚠️ Unknown priceId:", priceId);
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
