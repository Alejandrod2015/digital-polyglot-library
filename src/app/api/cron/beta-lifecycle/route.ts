// Beta lifecycle cron. Vercel hits this daily (configured in vercel.json).
// Sends the one beta email that applies to each tester today: install nudges,
// the feedback ask, the halfway survey, the final survey, and after launch the
// review ask or its recovery counterpart. Idempotent through BetaEmailLog, so
// a manual call is always safe.

import { NextResponse } from "next/server";
import { runBetaLifecycle } from "@/lib/betaLifecycle";

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
    const result = await runBetaLifecycle(new Date());
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
    console.error("❌ beta-lifecycle cron failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
