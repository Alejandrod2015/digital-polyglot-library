import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { serializeEntitlement } from "@/lib/billing";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";
import { verifyGooglePlaySubscriptionPurchase } from "@/lib/googlePlay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { purchaseToken?: unknown };
    const purchaseToken =
      typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";

    if (!purchaseToken) {
      return NextResponse.json({ error: "Missing purchaseToken" }, { status: 400 });
    }

    const verified = await verifyGooglePlaySubscriptionPurchase(purchaseToken);
    const entitlement = await prisma.billingEntitlement.upsert({
      where: { userId },
      create: {
        userId,
        plan: verified.plan,
        source: "google_play",
        status: verified.status,
        productId: verified.productId,
        purchaseToken: verified.purchaseToken,
        orderId: verified.orderId,
        willRenew: verified.willRenew,
        startedAt: verified.startedAt ?? new Date(),
        renewedAt: new Date(),
        expiresAt: verified.expiresAt,
        rawPayload: verified.rawPayload,
      },
      update: {
        plan: verified.plan,
        source: "google_play",
        status: verified.status,
        productId: verified.productId,
        purchaseToken: verified.purchaseToken,
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
    const message = error instanceof Error ? error.message : "Could not verify Google Play purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
