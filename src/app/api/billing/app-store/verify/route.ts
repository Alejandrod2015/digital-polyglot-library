import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { serializeEntitlement } from "@/lib/billing";
import { applyAppleVerifiedTransaction } from "@/lib/appStoreEntitlement";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { signedTransactionInfo?: unknown };
    const signedTransactionInfo =
      typeof body.signedTransactionInfo === "string" ? body.signedTransactionInfo.trim() : "";

    if (!signedTransactionInfo) {
      return NextResponse.json({ error: "Missing signedTransactionInfo" }, { status: 400 });
    }

    const entitlement = await applyAppleVerifiedTransaction(userId, signedTransactionInfo);
    return NextResponse.json(serializeEntitlement(entitlement));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not verify App Store purchase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
