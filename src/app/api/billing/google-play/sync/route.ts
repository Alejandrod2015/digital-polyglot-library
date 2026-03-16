import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { serializeEntitlement } from "@/lib/billing";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";
import { verifyGooglePlaySubscriptionPurchase } from "@/lib/googlePlay";

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

    const verified = await verifyGooglePlaySubscriptionPurchase(existing.purchaseToken);
    const entitlement = await prisma.billingEntitlement.update({
      where: { userId },
      data: {
        plan: verified.plan,
        status: verified.status,
        productId: verified.productId,
        orderId: verified.orderId,
        willRenew: verified.willRenew,
        renewedAt: new Date(),
        expiresAt: verified.expiresAt,
        rawPayload: verified.rawPayload,
      },
    });

    await syncClerkPlanFromEntitlement(userId, entitlement);

    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync Google Play purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
