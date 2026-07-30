// Orchestrates sending a PushCampaign: resolve recipients, deliver via
// APNs (iOS) and FCM (Android), tally results, and persist status/counts.
// Used by the Studio "Send now" action and the scheduled-send cron.

import { prisma } from "@/lib/prisma";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import { isFcmConfigured, sendFcmPush } from "@/lib/fcmPush";
import { resolvePushRecipients } from "@/lib/pushRecipients";

export type SendCampaignResult =
  | { ok: true; recipientCount: number; deliveredCount: number; failedCount: number }
  | { ok: false; error: string };

export async function sendCampaign(campaignId: string): Promise<SendCampaignResult> {
  const campaign = await prisma.pushCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status === "sending") return { ok: false, error: "Campaign is already sending" };
  if (campaign.status === "sent") return { ok: false, error: "Campaign was already sent" };

  // Basta con UNA plataforma configurada para enviar: si solo hay APNs, la
  // campaña sale a iOS y los tokens de Android cuentan como fallidos (con
  // el motivo en `lastError`), en vez de bloquear la campaña entera.
  const apnsReady = isApnsConfigured();
  const fcmReady = isFcmConfigured();
  if (!apnsReady && !fcmReady) {
    const error = "No push transport is configured (missing APNS_* and FCM_* env vars).";
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: { status: "draft", lastError: error },
    });
    return { ok: false, error };
  }

  await prisma.pushCampaign.update({
    where: { id: campaignId },
    data: { status: "sending", lastError: null },
  });

  try {
    const { apnsTokens, fcmTokens, userCount } = await resolvePushRecipients({
      target: campaign.target === "all" ? "all" : "type_subscribers",
      notificationTypeKey: campaign.notificationTypeKey,
    });

    if (apnsTokens.length + fcmTokens.length === 0) {
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

    const payload: { title: string; body: string; data: Record<string, string> } = {
      title: campaign.title,
      body: campaign.body,
      // `campaignId` lets the device attribute the open back to this campaign
      // (fires a `push_opened` UserMetric event → open rate in Studio).
      data: {
        campaignId: campaign.id,
        ...(campaign.notificationTypeKey
          ? { notificationType: campaign.notificationTypeKey }
          : {}),
      },
    };

    // Un transporte caído no debe tumbar el otro: cada mitad se resuelve por
    // su cuenta, y tanto "no configurado" como una excepción del sender se
    // degradan a "esos tokens fallaron, con el motivo" en vez de propagar.
    type SendResult = { token: string; ok: boolean; status: number; reason?: string };
    const allFailed = (tokens: string[], reason: string): SendResult[] =>
      tokens.map((token) => ({ token, ok: false, status: 0, reason }));

    async function deliver(
      tokens: string[],
      ready: boolean,
      label: string,
      send: (
        tokens: string[],
        alert: { title: string; body: string; data: Record<string, string> },
      ) => Promise<SendResult[]>,
    ): Promise<SendResult[]> {
      if (tokens.length === 0) return [];
      if (!ready) return allFailed(tokens, `${label} is not configured`);
      try {
        return await send(tokens, payload);
      } catch (err) {
        return allFailed(tokens, err instanceof Error ? err.message : `${label} send failed`);
      }
    }

    const [apnsResults, fcmResults] = await Promise.all([
      deliver(apnsTokens, apnsReady, "APNs", sendApnsPush),
      deliver(fcmTokens, fcmReady, "FCM", sendFcmPush),
    ]);
    const results = [...apnsResults, ...fcmResults];

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
