export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { serializeEntitlement } from "@/lib/billing";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import type { Plan } from "@domain/access";

declare global {
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

function isPlan(value: unknown): value is Exclude<Plan, undefined> {
  return (
    value === "free" ||
    value === "basic" ||
    value === "premium" ||
    value === "polyglot" ||
    value === "owner"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [entitlement, user] = await Promise.all([
    prisma.billingEntitlement.findUnique({
      where: { userId: session.sub },
    }),
    clerkClient.users.getUser(session.sub).catch(() => null),
  ]);

  const serialized = serializeEntitlement(entitlement);
  const publicMetadata = user?.publicMetadata ?? {};
  const metadataPlan = publicMetadata.plan;
  const effectivePlan = isPlan(metadataPlan) ? metadataPlan : serialized.plan;

  return NextResponse.json({
    ...serialized,
    hasEntitlement:
      serialized.hasEntitlement ||
      effectivePlan === "basic" ||
      effectivePlan === "premium" ||
      effectivePlan === "polyglot" ||
      effectivePlan === "owner",
    plan: effectivePlan,
    source:
      serialized.source ??
      (typeof publicMetadata.billingSource === "string" ? publicMetadata.billingSource : "clerk"),
    books: isStringArray(publicMetadata.books) ? publicMetadata.books : [],
    interests: isStringArray(publicMetadata.interests) ? publicMetadata.interests : [],
    targetLanguages: isStringArray(publicMetadata.targetLanguages)
      ? publicMetadata.targetLanguages
      : [],
  });
}
