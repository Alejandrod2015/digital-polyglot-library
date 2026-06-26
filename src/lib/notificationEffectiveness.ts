// Notification effectiveness: the data behind the Studio "Efectividad" tab.
//
// Two channels:
//  - Local daily reminder (on-device): tracked as UserMetric events
//    `reminder_scheduled` → `reminder_tapped` → `reminder_destination_opened`
//    (storySlug "daily-loop", bookSlug "mobile").
//  - Remote push campaigns (APNs): PushCampaign rows hold delivered/failed,
//    and opens are tracked as UserMetric `push_opened` events whose
//    metadata.campaignId points back to the campaign.
//
// Everything excludes internal (studio team) userIds so the numbers reflect
// real users, matching the metrics dashboard.

import { prisma } from "@/lib/prisma";
import { getInternalUserIds } from "@/lib/metricsAccess";
import { resolveUserEmails } from "@/lib/metricsUserEmails";

export type EffectivenessRange = "7d" | "30d" | "all";

const RECENT_ACTIVITY_LIMIT = 40;

export type ReminderFunnel = {
  scheduled: number;
  tapped: number;
  destinationOpened: number;
  tapRateFromScheduled: number;
  openRateFromTap: number;
  destinationBreakdown: Array<{ destination: string; opens: number }>;
};

export type RecentActivityRow = {
  userId: string;
  email: string | null;
  eventType: string;
  /** Local reminder destination (resumeStory/practiceDue/journey) or null. */
  destination: string | null;
  /** Push campaign title when the event is a push_opened, else null. */
  campaignTitle: string | null;
  createdAt: string;
};

export type CampaignEffectiveness = {
  id: string;
  title: string;
  body: string;
  notificationTypeKey: string | null;
  target: string;
  status: string;
  sentAt: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  opened: number;
  openRate: number;
};

export type NotificationEffectiveness = {
  range: EffectivenessRange;
  reminderFunnel: ReminderFunnel;
  campaigns: CampaignEffectiveness[];
  recentActivity: RecentActivityRow[];
};

function rangeStart(range: EffectivenessRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function getNotificationEffectiveness(
  range: EffectivenessRange
): Promise<NotificationEffectiveness> {
  const internalIds = await getInternalUserIds();
  const excludeInternal =
    internalIds.length > 0 ? { userId: { notIn: internalIds } } : {};
  const from = rangeStart(range);
  const createdAtFilter = from ? { createdAt: { gte: from } } : {};

  const [
    reminderFunnelRows,
    reminderDestinationRows,
    pushOpenedRows,
    sentCampaigns,
    recentReminderRows,
  ] = await Promise.all([
    // Reminder funnel counts.
    prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...excludeInternal,
        ...createdAtFilter,
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: {
          in: ["reminder_scheduled", "reminder_tapped", "reminder_destination_opened"],
        },
      },
      _count: { _all: true },
    }),
    // Reminder destination breakdown (one row per open, read metadata.targetKind).
    prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        ...createdAtFilter,
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_destination_opened",
      },
      select: { metadata: true },
    }),
    // Push opens: one row per open, metadata.campaignId attributes the campaign.
    prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        ...createdAtFilter,
        eventType: "push_opened",
      },
      select: { userId: true, metadata: true },
    }),
    // Sent campaigns (the ones with delivery data to score).
    prisma.pushCampaign.findMany({
      where: { status: "sent", ...(from ? { sentAt: { gte: from } } : {}) },
      orderBy: { sentAt: "desc" },
    }),
    // Recent per-user activity across both channels.
    prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        ...createdAtFilter,
        eventType: { in: ["reminder_tapped", "reminder_destination_opened", "push_opened"] },
      },
      select: { userId: true, eventType: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_LIMIT,
    }),
  ]);

  // ── Reminder funnel ──
  const reminderCounts = { scheduled: 0, tapped: 0, destinationOpened: 0 };
  for (const row of reminderFunnelRows) {
    if (row.eventType === "reminder_scheduled") reminderCounts.scheduled = row._count._all;
    if (row.eventType === "reminder_tapped") reminderCounts.tapped = row._count._all;
    if (row.eventType === "reminder_destination_opened") {
      reminderCounts.destinationOpened = row._count._all;
    }
  }
  const destinationMap = new Map<string, number>();
  for (const row of reminderDestinationRows) {
    const destination = metadataString(row.metadata, "targetKind") ?? "unknown";
    destinationMap.set(destination, (destinationMap.get(destination) ?? 0) + 1);
  }
  const destinationBreakdown = Array.from(destinationMap.entries())
    .map(([destination, opens]) => ({ destination, opens }))
    .sort((a, b) => b.opens - a.opens || a.destination.localeCompare(b.destination));

  const reminderFunnel: ReminderFunnel = {
    scheduled: reminderCounts.scheduled,
    tapped: reminderCounts.tapped,
    destinationOpened: reminderCounts.destinationOpened,
    tapRateFromScheduled: pct(reminderCounts.tapped, reminderCounts.scheduled),
    openRateFromTap: pct(reminderCounts.destinationOpened, reminderCounts.tapped),
    destinationBreakdown,
  };

  // ── Push opens per campaign (distinct users) ──
  const opensByCampaign = new Map<string, Set<string>>();
  for (const row of pushOpenedRows) {
    const campaignId = metadataString(row.metadata, "campaignId");
    if (!campaignId) continue;
    if (!opensByCampaign.has(campaignId)) opensByCampaign.set(campaignId, new Set());
    opensByCampaign.get(campaignId)!.add(row.userId);
  }

  const campaigns: CampaignEffectiveness[] = sentCampaigns.map((c) => {
    const opened = opensByCampaign.get(c.id)?.size ?? 0;
    return {
      id: c.id,
      title: c.title,
      body: c.body,
      notificationTypeKey: c.notificationTypeKey,
      target: c.target,
      status: c.status,
      sentAt: c.sentAt ? c.sentAt.toISOString() : null,
      recipientCount: c.recipientCount,
      deliveredCount: c.deliveredCount,
      failedCount: c.failedCount,
      opened,
      openRate: pct(opened, c.deliveredCount),
    };
  });

  // ── Recent activity (resolve emails + campaign titles) ──
  const campaignTitleById = new Map(sentCampaigns.map((c) => [c.id, c.title] as const));
  const emails = await resolveUserEmails(recentReminderRows.map((r) => r.userId));
  const recentActivity: RecentActivityRow[] = recentReminderRows.map((row) => ({
    userId: row.userId,
    email: emails.get(row.userId) ?? null,
    eventType: row.eventType,
    destination: metadataString(row.metadata, "targetKind"),
    campaignTitle:
      row.eventType === "push_opened"
        ? campaignTitleById.get(metadataString(row.metadata, "campaignId") ?? "") ?? null
        : null,
    createdAt: row.createdAt.toISOString(),
  }));

  return { range, reminderFunnel, campaigns, recentActivity };
}
