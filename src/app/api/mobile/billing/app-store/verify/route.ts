import { NextRequest, NextResponse } from "next/server";
import { serializeEntitlement } from "@/lib/billing";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { applyAppleVerifiedTransaction } from "@/lib/appStoreEntitlement";

export const runtime = "nodejs";

/**
 * iOS native In-App Purchase verification. The app (react-native-iap, StoreKit
 * 2) posts the signed transaction JWS right after a purchase/restore. Auth is
 * the mobile session token (Bearer), mirroring the other /api/mobile/billing
 * routes. Server-side it reuses the same verify+upsert+sync as the web route.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await getActiveMobileSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { signedTransactionInfo?: unknown };
    const signedTransactionInfo =
      typeof body.signedTransactionInfo === "string" ? body.signedTransactionInfo.trim() : "";

    if (!signedTransactionInfo) {
      return NextResponse.json({ error: "Missing signedTransactionInfo" }, { status: 400 });
    }

    const entitlement = await applyAppleVerifiedTransaction(session.sub, signedTransactionInfo);
    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify App Store purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
