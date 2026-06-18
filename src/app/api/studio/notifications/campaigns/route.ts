// Admin endpoint for push campaigns (Fase 2). Admin only.
// GET    → list campaigns, newest first, plus whether APNs is configured.
// POST   → create a draft campaign.
// PATCH  → edit a draft, or { id, action: "send" } to send it now.
// DELETE → remove a campaign.

export const runtime = "nodejs";
export const maxDuration = 300;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { getStudioMember } from "@/lib/studio-access";
import { isNotificationTypeKey } from "@/lib/notifications";
import { isApnsConfigured } from "@/lib/apnsPush";
import { sendCampaign } from "@/lib/pushCampaigns";

const VALID_TARGETS = ["all", "type_subscribers"] as const;

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
  const campaigns = await prisma.pushCampaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ campaigns, apnsConfigured: isApnsConfigured() });
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.body === "string" ? body.body.trim() : "";
  if (!title || !message) {
    return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  }
  const target = VALID_TARGETS.includes(body?.target) ? body.target : "type_subscribers";
  const notificationTypeKey = isNotificationTypeKey(body?.notificationTypeKey)
    ? body.notificationTypeKey
    : null;
  if (target === "type_subscribers" && !notificationTypeKey) {
    return NextResponse.json(
      { error: "A notification type is required when targeting subscribers." },
      { status: 400 },
    );
  }
  const scheduledAt =
    typeof body?.scheduledAt === "string" && body.scheduledAt
      ? new Date(body.scheduledAt)
      : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt." }, { status: 400 });
  }

  const created = await prisma.pushCampaign.create({
    data: {
      title,
      body: message,
      target,
      notificationTypeKey,
      scheduledAt,
      status: scheduledAt ? "scheduled" : "draft",
      createdByEmail: check.email,
    },
  });
  return NextResponse.json(created);
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

  const existing = await prisma.pushCampaign.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Send-now action.
  if (body.action === "send") {
    const result = await sendCampaign(body.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const updated = await prisma.pushCampaign.findUnique({ where: { id: body.id } });
    return NextResponse.json({ ok: true, campaign: updated });
  }

  // Otherwise edit fields (only while still editable).
  if (existing.status === "sent" || existing.status === "sending") {
    return NextResponse.json({ error: "A sent or sending campaign cannot be edited." }, { status: 400 });
  }

  const data: Prisma.PushCampaignUpdateInput = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.body === "string") data.body = body.body.trim();
  if (VALID_TARGETS.includes(body.target)) data.target = body.target;
  if (body.notificationTypeKey === null || isNotificationTypeKey(body.notificationTypeKey)) {
    data.notificationTypeKey = body.notificationTypeKey ?? null;
  }
  if (typeof body.scheduledAt === "string" || body.scheduledAt === null) {
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt." }, { status: 400 });
    }
    data.scheduledAt = scheduledAt;
    data.status = scheduledAt ? "scheduled" : "draft";
  }

  const updated = await prisma.pushCampaign.update({ where: { id: body.id }, data });
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
  await prisma.pushCampaign.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
