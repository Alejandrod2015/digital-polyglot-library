import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyGooglePlaySubscriptionPurchase } from "@/lib/googlePlay";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";

export const runtime = "nodejs";

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
  };
  subscription?: string;
};

type GooglePlayRtdnPayload = {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    purchaseToken?: string;
    subscriptionId?: string;
    notificationType?: number;
  };
  oneTimeProductNotification?: {
    purchaseToken?: string;
    sku?: string;
    notificationType?: number;
  };
  testNotification?: Record<string, unknown>;
};

function decodePubSubData(data: string) {
  return Buffer.from(data, "base64").toString("utf8");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PubSubPushBody;
    const rawData = body.message?.data;

    if (!rawData) {
      return NextResponse.json({ error: "Missing Pub/Sub message data." }, { status: 400 });
    }

    const decoded = decodePubSubData(rawData);
    const payload = JSON.parse(decoded) as GooglePlayRtdnPayload;
    const purchaseToken =
      payload.subscriptionNotification?.purchaseToken ??
      payload.oneTimeProductNotification?.purchaseToken ??
      null;

    if (!purchaseToken) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const existing = await prisma.billingEntitlement.findFirst({
      where: {
        source: "google_play",
        purchaseToken,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const verified = await verifyGooglePlaySubscriptionPurchase(purchaseToken);
    const entitlement = await prisma.billingEntitlement.update({
      where: { userId: existing.userId },
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

    await syncClerkPlanFromEntitlement(existing.userId, entitlement);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process RTDN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
