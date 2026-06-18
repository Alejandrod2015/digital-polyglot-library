// Admin endpoint for /studio/notificaciones. Admin only.
// GET   → all known notification types (DB row merged over code default),
//         including inactive ones, so the editor can show every type.
// PATCH → upsert one type by key (copy, hour, channel, active flags).

export const runtime = "nodejs";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";
import {
  NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_TYPE_DEFAULTS,
  isNotificationTypeKey,
  type NotificationChannel,
} from "@/lib/notifications";

const VALID_CHANNELS: NotificationChannel[] = ["local", "remote", "both"];

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

  let rows: Awaited<ReturnType<typeof prisma.notificationTypeConfig.findMany>> = [];
  try {
    rows = await prisma.notificationTypeConfig.findMany();
  } catch {
    rows = [];
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const types = NOTIFICATION_TYPE_KEYS.map((key) => {
    const def = NOTIFICATION_TYPE_DEFAULTS[key];
    const row = byKey.get(key);
    return {
      key,
      label: row?.label ?? def.label,
      description: row?.description ?? def.description,
      title: row?.title ?? def.title,
      body: row?.body ?? def.body,
      hourDefault: row && row.hourDefault != null ? row.hourDefault : def.hourDefault,
      localEnabledByDefault: row ? row.localEnabledByDefault : def.localEnabledByDefault,
      channel: (row?.channel as NotificationChannel) ?? def.channel,
      active: row ? row.active : true,
      sortOrder: row?.sortOrder ?? def.sortOrder,
      // Whether this is persisted yet (vs showing code defaults).
      hasRow: Boolean(row),
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  return NextResponse.json({ types });
}

export async function PATCH(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const rawKey: unknown = body?.key;
  if (!body || !isNotificationTypeKey(rawKey)) {
    return NextResponse.json(
      { error: "Invalid body. Required: { key: NotificationTypeKey }" },
      { status: 400 },
    );
  }
  const key = rawKey;
  const def = NOTIFICATION_TYPE_DEFAULTS[key];

  if (body.channel != null && !VALID_CHANNELS.includes(body.channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if (
    body.hourDefault != null &&
    (typeof body.hourDefault !== "number" || body.hourDefault < 0 || body.hourDefault > 23)
  ) {
    return NextResponse.json({ error: "Invalid hourDefault (0-23)" }, { status: 400 });
  }

  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  const data = {
    label: str(body.label, def.label),
    description:
      typeof body.description === "string" ? body.description.trim() || null : def.description,
    title: str(body.title, def.title),
    body: str(body.body, def.body),
    hourDefault:
      body.hourDefault === null
        ? null
        : typeof body.hourDefault === "number"
          ? body.hourDefault
          : def.hourDefault,
    localEnabledByDefault:
      typeof body.localEnabledByDefault === "boolean"
        ? body.localEnabledByDefault
        : def.localEnabledByDefault,
    channel: (body.channel as NotificationChannel) ?? def.channel,
    active: typeof body.active === "boolean" ? body.active : true,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : def.sortOrder,
  };

  const updated = await prisma.notificationTypeConfig.upsert({
    where: { key },
    create: { key, ...data },
    update: data,
  });

  return NextResponse.json(updated);
}
