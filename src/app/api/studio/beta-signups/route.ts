// Admin endpoint for /studio/beta-signups. Admin only.
// GET   → list all beta applications, newest first
// PATCH → update status (pending|invited|accepted|declined) and/or notes
// DELETE → remove a row (e.g. spam)

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";

const betaSignup = prisma.betaSignup;

const VALID_STATUS = ["pending", "invited", "accepted", "declined"] as const;

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 } as const;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return { error: "Unauthorized", status: 401 } as const;

  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return { error: "Forbidden: admin only", status: 403 } as const;
  }

  return { email } as const;
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const rows = await betaSignup.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid body. Required: { id: string }" }, { status: 400 });
  }

  if (body.status && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await betaSignup.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.status) {
    data.status = body.status;
    if (body.status === "invited" && !existing.invitedAt) {
      data.invitedAt = new Date();
    }
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.trim() || null;
  }

  const updated = await betaSignup.update({ where: { id: body.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid body. Required: { id: string }" }, { status: 400 });
  }

  await betaSignup.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
