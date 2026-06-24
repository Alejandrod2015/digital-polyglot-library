import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeAppleNotification } from "@/lib/appStore";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";

export const runtime = "nodejs";

/**
 * App Store Server Notifications v2 endpoint. Apple POSTs `{ signedPayload }`
 * (a JWS) on every lifecycle event (renew, fail-to-renew, expire, refund...).
 * We verify it, then update the matching `BillingEntitlement` by its
 * originalTransactionId (stored as purchaseToken). Mirrors the Google Play
 * RTDN handler: unknown / unmatched notifications are acked and ignored.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { signedPayload?: unknown };
    const signedPayload =
      typeof body.signedPayload === "string" ? body.signedPayload : "";

    if (!signedPayload) {
      return NextResponse.json({ error: "Missing signedPayload." }, { status: 400 });
    }

    const decoded = await decodeAppleNotification(signedPayload);

    // Apple sends a TEST notification when you validate the endpoint.
    if (decoded.notificationType === "TEST") {
      return NextResponse.json({ ok: true, test: true });
    }

    const subscription = decoded.subscription;
    if (!subscription) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const existing = await prisma.billingEntitlement.findFirst({
      where: {
        source: "app_store",
        purchaseToken: subscription.originalTransactionId,
      },
    });

    // No linked account yet (e.g. notification arrives before the client
    // verify call). Ack so Apple stops retrying; the verify call will create
    // the row with fresh data.
    if (!existing) {
      return NextResponse.json({ ok: true, unlinked: true });
    }

    const entitlement = await prisma.billingEntitlement.update({
      where: { userId: existing.userId },
      data: {
        plan: subscription.plan,
        status: subscription.status,
        productId: subscription.productId,
        orderId: subscription.transactionId,
        willRenew: subscription.willRenew,
        renewedAt: new Date(),
        expiresAt: subscription.expiresAt,
        rawPayload: subscription.rawPayload,
      },
    });

    await syncClerkPlanFromEntitlement(existing.userId, entitlement);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not process App Store notification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
