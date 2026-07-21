import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { serializeEntitlement } from "@/lib/billing";
import { applyGooglePlayVerifiedPurchase } from "@/lib/googlePlayEntitlement";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.billingEntitlement.findUnique({
      where: { userId },
    });

    if (!existing || existing.source !== "google_play" || !existing.purchaseToken) {
      return NextResponse.json(
        { error: "No Google Play purchase is linked to this account." },
        { status: 404 }
      );
    }

    // Re-verify the stored token against Google and re-apply, sharing the same
    // verify + upsert + Clerk-sync path as the verify/RTDN routes.
    const entitlement = await applyGooglePlayVerifiedPurchase(userId, existing.purchaseToken);

    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync Google Play purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
