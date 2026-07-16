import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { serializeEntitlement } from "@/lib/billing";
import { applyGooglePlayVerifiedPurchase } from "@/lib/googlePlayEntitlement";

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

    const entitlement = await applyGooglePlayVerifiedPurchase(userId, purchaseToken);

    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify Google Play purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
