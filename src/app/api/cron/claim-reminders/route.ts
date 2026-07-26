// Unredeemed-claim reminder cron. Vercel hits this daily (see vercel.json).
// Resends the access link to buyers who paid but never opened their claim,
// on a capped cadence (48h, then 7 days, max 2). Manually callable; if
// CRON_SECRET is set the caller must pass `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from "next/server";
import { runClaimReminders } from "@/lib/claimReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const result = await runClaimReminders(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("❌ claim-reminders cron failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
