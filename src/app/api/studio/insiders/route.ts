export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import { currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { syncClerkPlanFromEntitlement } from "@/lib/billingClerk";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/**
 * Grupo insider (2026-09-06): miembro = premium gratis mientras participe.
 * El mecanismo es una BillingEntitlement de fuente `comp` (cortesia), asi que
 * viaja por la MISMA tuberia que Stripe/Play/App Store: sync a
 * publicMetadata.plan, gates de web y movil, endpoint de entitlement. Alta y
 * baja son una fila; nada que tocar en los gates.
 *
 * - GET: lista los miembros actuales.
 * - POST { email }: alta. Rechaza si la persona ya paga (no pisar una
 *   suscripcion real con una cortesia).
 * - DELETE { email }: baja. Borra la fila y re-sincroniza; la persona cae a
 *   lo que le toque (gracia beta o basic).
 */

async function requireStudio(): Promise<NextResponse | null> {
  const user = await currentUser().catch(() => null);
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function resolveUserByEmail(email: string) {
  const result = await clerkClient.users.getUserList({ emailAddress: [email] });
  return result.data[0] ?? null;
}

export async function GET() {
  const denied = await requireStudio();
  if (denied) return denied;

  const rows = await prisma.billingEntitlement.findMany({
    where: { source: "comp" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, status: true, startedAt: true, rawPayload: true },
  });

  return NextResponse.json({
    members: rows.map((row) => ({
      userId: row.userId,
      status: row.status,
      since: row.startedAt.toISOString(),
      email:
        row.rawPayload && typeof row.rawPayload === "object" && "email" in row.rawPayload
          ? (row.rawPayload as { email?: string }).email ?? null
          : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireStudio();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const user = await resolveUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: `No Clerk user for ${email}` }, { status: 404 });
  }

  const existing = await prisma.billingEntitlement.findUnique({ where: { userId: user.id } });
  if (existing && existing.source !== "comp") {
    return NextResponse.json(
      { error: `${email} already has a ${existing.source} entitlement; not overwriting a paid subscription.` },
      { status: 409 }
    );
  }

  const entitlement = await prisma.billingEntitlement.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "premium",
      source: "comp",
      status: "active",
      willRenew: false,
      rawPayload: { email, reason: "insider" },
    },
    update: {
      plan: "premium",
      status: "active",
      rawPayload: { email, reason: "insider" },
    },
  });

  await syncClerkPlanFromEntitlement(user.id, entitlement);
  return NextResponse.json({ ok: true, userId: user.id });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireStudio();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const user = await resolveUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: `No Clerk user for ${email}` }, { status: 404 });
  }

  const existing = await prisma.billingEntitlement.findUnique({ where: { userId: user.id } });
  if (!existing || existing.source !== "comp") {
    return NextResponse.json(
      { error: existing ? "Entitlement is not comp; refusing." : "Not a member." },
      { status: existing ? 409 : 404 }
    );
  }

  await prisma.billingEntitlement.delete({ where: { userId: user.id } });
  await syncClerkPlanFromEntitlement(user.id, null);
  return NextResponse.json({ ok: true });
}
