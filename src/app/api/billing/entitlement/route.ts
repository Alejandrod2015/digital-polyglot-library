import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { serializeEntitlement } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await prisma.billingEntitlement.findUnique({
    where: { userId },
  });

  return NextResponse.json(serializeEntitlement(entitlement));
}
