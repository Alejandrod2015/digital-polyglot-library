// Lifecycle email cron. Vercel hits this daily (configured in vercel.json).
// For each recent signup it sends the one lifecycle email that applies, using
// real per-user data, idempotently. Manually callable; if CRON_SECRET is set
// the caller must pass `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from "next/server";
import { runLifecycleEmails } from "@/lib/lifecycleEngine";

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
    const result = await runLifecycleEmails(new Date());
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      sent: result.sent.length,
      byKind: result.sent.reduce<Record<string, number>>((acc, s) => {
        acc[s.kind] = (acc[s.kind] ?? 0) + 1;
        return acc;
      }, {}),
      skipped: result.skipped,
    });
  } catch (err) {
    console.error("❌ lifecycle-emails cron failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
