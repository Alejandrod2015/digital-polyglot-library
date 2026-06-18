// Orchestrates sending a PushCampaign: resolve recipients, deliver via
// APNs, tally results, and persist status/counts. Used by the Studio
// "Send now" action and the scheduled-send cron.

import { prisma } from "@/lib/prisma";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import { resolvePushRecipients } from "@/lib/pushRecipients";

export type SendCampaignResult =
  | { ok: true; recipientCount: number; deliveredCount: number; failedCount: number }
  | { ok: false; error: string };

export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  const campaign = await prisma.pushCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status === "sending") return { ok: false, error: "Campaign is already sending" };
  if (campaign.status === "sent") return { ok: false, error: "Campaign was already sent" };

  if (!isApnsConfigured()) {
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: { status: "draft", lastError: "APNs is not configured (missing APNS_* env vars)." },
    });
    return { ok: false, error: "APNs is not configured (missing APNS_* env vars)." };
  }

  await prisma.pushCampaign.update({
    where: { id: campaignId },
    data: { status: "sending", lastError: null },
  });

  try {
    const { tokens, userCount } = await resolvePushRecipients({
      target: campaign.target === "all" ? "all" : "type_subscribers",
      notificationTypeKey: campaign.notificationTypeKey,
    });

    if (tokens.length === 0) {
      await prisma.pushCampaign.update({
        where: { id: campaignId },
        data: {
          status: "sent",
          sentAt: new Date(),
          recipientCount: 0,
          deliveredCount: 0,
          failedCount: 0,
          lastError: "No matching recipients with a device token.",
        },
      });
      return { ok: true, recipientCount: 0, deliveredCount: 0, failedCount: 0 };
    }

    const results = await sendApnsPush(tokens, {
      title: campaign.title,
      body: campaign.body,
      data: campaign.notificationTypeKey
        ? { notificationType: campaign.notificationTypeKey }
        : undefined,
    });

    const delivered = results.filter((r) => r.ok).length;
    const failed = results.length - delivered;
    // Surface the most common failure reason (helps debug bad-token vs auth).
    const firstReason = results.find((r) => !r.ok && r.reason)?.reason ?? null;

    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: {
        status: "sent",
        sentAt: new Date(),
        recipientCount: userCount,
        deliveredCount: delivered,
        failedCount: failed,
        lastError: failed > 0 ? `${failed} failed (e.g. ${firstReason ?? "unknown"}).` : null,
      },
    });

    return { ok: true, recipientCount: userCount, deliveredCount: delivered, failedCount: failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", lastError: message },
    });
    return { ok: false, error: message };
  }
}
