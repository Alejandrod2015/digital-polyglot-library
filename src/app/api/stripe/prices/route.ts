import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  STRIPE_PREMIUM_ANNUAL_PRICE_ID,
} from "@domain/billingCatalog";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Clerk/Stripe need the Node runtime.
export const runtime = "nodejs";

function format(amount: number | null, currency: string | null): string | null {
  if (amount == null || !currency) return null;
  const value = amount / 100;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Single source of truth for the displayed subscription prices.
 * Reads the live Stripe price objects so the /plans page never drifts from
 * what Stripe actually charges. On failure returns nulls (the client falls
 * back to the labels in billingCatalog).
 */
export async function GET() {
  try {
    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(STRIPE_PREMIUM_MONTHLY_PRICE_ID),
      stripe.prices.retrieve(STRIPE_PREMIUM_ANNUAL_PRICE_ID),
    ]);

    const res = NextResponse.json({
      monthly: format(monthly.unit_amount, monthly.currency),
      annual: format(annual.unit_amount, annual.currency),
    });
    // Cache at the edge; prices change rarely.
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    return res;
  } catch (err: unknown) {
    console.error("STRIPE PRICES ERROR:", err);
    return NextResponse.json({ monthly: null, annual: null }, { status: 200 });
  }
}
