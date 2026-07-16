import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPubSubOidcToken } from "@/lib/googlePubSub";
import { applyGooglePlayVerifiedPurchase } from "@/lib/googlePlayEntitlement";

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
  // Authenticate the caller before doing anything else: the push must carry a
  // valid Google-signed OIDC token, or this endpoint would accept forged
  // renewal/cancellation notifications from anyone.
  try {
    await verifyPubSubOidcToken(req.headers.get("authorization"));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as PubSubPushBody;
    const rawData = body.message?.data;

    if (!rawData) {
      return NextResponse.json({ error: "Missing Pub/Sub message data." }, { status: 400 });
    }

    const decoded = decodePubSubData(rawData);
    const payload = JSON.parse(decoded) as GooglePlayRtdnPayload;

    // Ignore notifications for any other app that might share this endpoint.
    const expectedPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
    if (expectedPackage && payload.packageName && payload.packageName !== expectedPackage) {
      return NextResponse.json({ ok: true, ignored: true });
    }

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

    // Re-verify against Google and re-apply, sharing the same verify + upsert +
    // Clerk-sync path as the verify/sync routes.
    await applyGooglePlayVerifiedPurchase(existing.userId, purchaseToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process RTDN.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
