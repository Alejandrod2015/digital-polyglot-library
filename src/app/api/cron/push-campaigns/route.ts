// Scheduled push send cron. Vercel hits this (configure in vercel.json);
// it finds campaigns whose scheduledAt is due and sends each. Manually
// callable; if CRON_SECRET is set the caller must pass
// `Authorization: Bearer <CRON_SECRET>`.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCampaign } from "@/lib/pushCampaigns";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no-auth mode
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.pushCampaign.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 25,
  });

  const sent: Array<{ id: string; ok: boolean; delivered?: number; error?: string }> = [];
  for (const campaign of due) {
    const result = await sendCampaign(campaign.id);
    sent.push(
      result.ok
        ? { id: campaign.id, ok: true, delivered: result.deliveredCount }
        : { id: campaign.id, ok: false, error: result.error },
    );
  }

  return NextResponse.json({ ok: true, due: due.length, sent });
}
