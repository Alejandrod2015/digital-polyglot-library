import { NextRequest, NextResponse } from "next/server";
import { serializeEntitlement } from "@/lib/billing";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { applyGooglePlayVerifiedPurchase } from "@/lib/googlePlayEntitlement";

export const runtime = "nodejs";

/**
 * Android native In-App Purchase verification. The app (expo-iap, Play Billing)
 * posts the purchase token right after a purchase/restore. Auth is the mobile
 * session token (Bearer), mirroring the other /api/mobile/billing routes.
 * Server-side it reuses the same verify+upsert+sync as the web route.
 *
 * The app must only acknowledge the purchase (expo-iap `finishTransaction`)
 * AFTER this returns 2xx: Play auto-refunds purchases left unacknowledged for
 * three days.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await getActiveMobileSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { purchaseToken?: unknown };
    const purchaseToken =
      typeof body.purchaseToken === "string" ? body.purchaseToken.trim() : "";

    if (!purchaseToken) {
      return NextResponse.json({ error: "Missing purchaseToken" }, { status: 400 });
    }

    const entitlement = await applyGooglePlayVerifiedPurchase(session.sub, purchaseToken);
    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify Google Play purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
