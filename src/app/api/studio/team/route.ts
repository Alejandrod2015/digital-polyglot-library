import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- model available after prisma generate
const studioMember = (prisma as any).studioMember;

import {
  getStudioMember,
  invalidateStudioCache,
  type StudioRole,
} from "@/lib/studio-access";

const VALID_ROLES: StudioRole[] = ["admin", "manager", "content_creator"];

/** Verify the caller is a studio admin. */
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

  return { email, member } as const;
}

/**
 * GET /api/studio/team
 * List all studio members. Admin only.
 */
export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const members = await studioMember.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

/**
 * POST /api/studio/team
 * Add a new studio member. Admin only.
 * Body: { email: string, role: StudioRole, name?: string }
 */
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string" || !VALID_ROLES.includes(body.role)) {
    return NextResponse.json(
      { error: "Invalid body. Required: { email: string, role: admin|manager|content_creator }" },
      { status: 400 }
    );
  }

  const email = body.email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Check if already exists
  const existing = await studioMember.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Member already exists" }, { status: 409 });
  }

  const member = await studioMember.create({
    data: {
      email,
      role: body.role as StudioRole,
      name: typeof body.name === "string" ? body.name.trim() || null : null,
    },
  });

  invalidateStudioCache();
  return NextResponse.json(member, { status: 201 });
}

/**
 * PATCH /api/studio/team
 * Update a member's role or name. Admin only.
 * Body: { id: string, role?: StudioRole, name?: string }
 */
export async function PATCH(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid body. Required: { id: string }" }, { status: 400 });
  }

  if (body.role && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await studioMember.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent removing the last admin
  if (existing.role === "admin" && body.role && body.role !== "admin") {
    const adminCount = await studioMember.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 400 }
      );
    }
  }

  const updated = await studioMember.update({
    where: { id: body.id },
    data: {
      ...(body.role ? { role: body.role } : {}),
      ...(typeof body.name === "string" ? { name: body.name.trim() || null } : {}),
    },
  });

  invalidateStudioCache();
  return NextResponse.json(updated);
}

/**
 * DELETE /api/studio/team
 * Remove a member. Admin only.
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Invalid body. Required: { id: string }" }, { status: 400 });
  }

  const existing = await studioMember.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Prevent deleting the last admin
  if (existing.role === "admin") {
    const adminCount = await studioMember.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last admin" },
        { status: 400 }
      );
    }
  }

  await studioMember.delete({ where: { id: body.id } });
  invalidateStudioCache();
  return NextResponse.json({ ok: true });
}
