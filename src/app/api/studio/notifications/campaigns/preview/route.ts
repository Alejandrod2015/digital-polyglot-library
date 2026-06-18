// Dry-run for a push campaign: resolves how many users/devices WOULD
// receive it, without sending anything. No APNs credentials needed.
// Admin only.

export const runtime = "nodejs";
export const maxDuration = 120;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStudioMember } from "@/lib/studio-access";
import { isNotificationTypeKey } from "@/lib/notifications";
import { resolvePushRecipients } from "@/lib/pushRecipients";

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

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await req.json().catch(() => null);
  const target = body?.target === "all" ? "all" : "type_subscribers";
  const notificationTypeKey = isNotificationTypeKey(body?.notificationTypeKey)
    ? body.notificationTypeKey
    : null;
  if (target === "type_subscribers" && !notificationTypeKey) {
    return NextResponse.json(
      { error: "A notification type is required when targeting subscribers." },
      { status: 400 },
    );
  }

  const { tokens, userCount } = await resolvePushRecipients({ target, notificationTypeKey });
  return NextResponse.json({ userCount, deviceCount: tokens.length });
}
