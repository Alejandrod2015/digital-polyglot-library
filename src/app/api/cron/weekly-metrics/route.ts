// Weekly metrics digest cron. Vercel hits this every Monday at 08:00 UTC
// (configured in vercel.json) and forwards the founder-facing signals via
// Resend. Also callable manually for testing; if CRON_SECRET is set the
// caller must pass it as `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/weeklyDigest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no-auth mode
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyDigest();
  if (result.status === "sent") {
    return NextResponse.json({
      ok: true,
      to: result.to,
      signups: result.data.signupsThisWeek,
      activeUsers: result.data.activeUsersThisWeek,
      plays: result.data.playsThisWeek,
    });
  }
  if (result.status === "skipped") {
    return NextResponse.json({ ok: false, skipped: true, reason: result.reason });
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
}
