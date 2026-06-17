export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInternalUserIds, isMetricsAccessAllowed } from "@/lib/metricsAccess";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// Source-of-truth signups come from Clerk (the user.created webhook that
// mirrors them into UserMetric is unreliable). This endpoint lists Clerk
// users, filters to the requested window, and cross-references the prod DB
// to build the real activation funnel:
//   signup -> onboarded -> opened a story -> actually listened -> viewed plans -> paid
// Everything is read-only.

type RecentSignup = {
  userId: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  targetLanguages: string[];
  level: string | null;
  onboarded: boolean;
  openedStory: boolean;
  listenedSeconds: number;
  listened: boolean;
  completedStory: boolean;
  viewedPlans: boolean;
  paid: boolean;
  platform: "ios" | "web" | null;
};

const TEAM_DOMAINS = ["muvn.de"];
function isTeamEmail(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    TEAM_DOMAINS.some((d) => e.endsWith("@" + d)) ||
    e.includes("+betatest") ||
    e.endsWith("@example.com")
  );
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { key: string; at: number; payload: unknown } | null = null;

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
  const cacheKey = `acq:${days}`;
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const now = Date.now();
  const windowStart = now - days * 86400000;
  const d7 = now - 7 * 86400000;
  const d30 = now - 30 * 86400000;

  try {
    const internalIds = new Set(await getInternalUserIds());

    // Paginate all Clerk users (instance is small pre-launch; cap at 2000).
    const total = await clerkClient.users.getCount();
    const all: Awaited<ReturnType<typeof clerkClient.users.getUserList>>["data"] = [];
    for (let offset = 0; offset < total && offset < 2000; offset += 100) {
      const page = await clerkClient.users.getUserList({ orderBy: "-created_at", limit: 100, offset });
      all.push(...page.data);
      if (page.data.length < 100) break;
    }

    const external = all.filter((u) => {
      const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null;
      return !internalIds.has(u.id) && !isTeamEmail(email);
    });

    const totalExternal = external.length;
    const signupsLast7d = external.filter((u) => u.createdAt >= d7).length;
    const signupsLast30d = external.filter((u) => u.createdAt >= d30).length;

    // Cohort = users created within the requested window.
    const cohort = external.filter((u) => u.createdAt >= windowStart);
    const ids = cohort.map((u) => u.id);

    // ── DB cross-reference (single round of grouped queries) ──
    const [audioEvents, plansEvents, continueRows, entitlements] = await Promise.all([
      ids.length
        ? prisma.userMetric.findMany({
            where: { userId: { in: ids }, eventType: { in: ["story_opened", "audio_play", "audio_complete", "audio_pause", "continue_listening"] } },
            select: { userId: true, eventType: true, value: true, metadata: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.userMetric.findMany({
            where: { userId: { in: ids }, eventType: "plans_viewed" },
            select: { userId: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.continueListeningEntry.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, progressSec: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.billingEntitlement.findMany({
            where: { userId: { in: ids }, status: "active" },
            select: { userId: true, plan: true },
          })
        : Promise.resolve([]),
    ]);

    // Exclude story_opened from the audio set — it's an "opened" signal, not
    // an actual listen.
    const audioBy = new Set(
      audioEvents.filter((e) => e.eventType !== "story_opened").map((e) => e.userId)
    );
    const completedBy = new Set(
      audioEvents.filter((e) => e.eventType === "audio_complete").map((e) => e.userId)
    );
    const storyOpenedBy = new Set(
      audioEvents.filter((e) => e.eventType === "story_opened").map((e) => e.userId)
    );
    const plansBy = new Set(plansEvents.map((e) => e.userId));
    // "Abrió" = explicit story_opened event (new, clean) ∪ legacy signals
    // (resume rows / any audio event) so historical cohorts keep the step now
    // that sub-floor resume rows are no longer written.
    const openedBy = new Set<string>([
      ...storyOpenedBy,
      ...continueRows.map((c) => c.userId),
      ...audioBy,
    ]);
    // Furthest second reached per user. Decoupled from the resume row: take the
    // max across resume rows AND audio events (audio_pause carries the exact
    // position in `value`/metadata, continue_listening carries it in metadata),
    // so exact seconds show even for short (<10s, sub-resume-floor) listens.
    const listenedSecondsBy = new Map<string, number>();
    const bump = (userId: string, seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const prev = listenedSecondsBy.get(userId) ?? 0;
      listenedSecondsBy.set(userId, Math.max(prev, Math.round(seconds)));
    };
    for (const c of continueRows) bump(c.userId, c.progressSec ?? 0);
    for (const e of audioEvents) {
      if (e.eventType !== "audio_pause" && e.eventType !== "continue_listening") continue;
      const m = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>) : null;
      const fromMeta = typeof m?.progressSec === "number" ? m.progressSec : null;
      const fromValue = typeof e.value === "number" ? e.value : null;
      bump(e.userId, fromMeta ?? fromValue ?? 0);
    }
    const paidBy = new Set(
      entitlements.filter((e) => !(e.plan ?? "").toLowerCase().includes("free")).map((e) => e.userId)
    );

    // ── Platform split (iPhone app vs webapp) ──
    // Events are now stamped with metadata.platform at write time. For users
    // who were active before that, fall back to Clerk privateMetadata: anyone
    // with a registered mobile push token has the iOS app installed.
    const eventIos = new Set<string>();
    const eventWeb = new Set<string>();
    for (const e of audioEvents) {
      const m = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>) : null;
      const pf = typeof m?.platform === "string" ? m.platform : null;
      if (pf === "ios" || pf === "android" || pf === "mobile") eventIos.add(e.userId);
      else if (pf === "web") eventWeb.add(e.userId);
    }
    const hasMobilePushToken = (u: (typeof cohort)[number]): boolean => {
      const pm = (u.privateMetadata ?? {}) as Record<string, unknown>;
      return Array.isArray(pm.mobilePushTokens) && pm.mobilePushTokens.length > 0;
    };
    const platformFor = (u: (typeof cohort)[number]): "ios" | "web" | null => {
      if (eventIos.has(u.id) || hasMobilePushToken(u)) return "ios";
      if (eventWeb.has(u.id)) return "web";
      return null;
    };

    const recent: RecentSignup[] = cohort
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => {
        const md = (u.publicMetadata ?? {}) as Record<string, unknown>;
        const tls = Array.isArray(md.targetLanguages) ? (md.targetLanguages as string[]) : [];
        const secs = listenedSecondsBy.get(u.id) ?? 0;
        return {
          userId: u.id,
          name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
          email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
          createdAt: new Date(u.createdAt).toISOString(),
          lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
          targetLanguages: tls,
          level: typeof md.preferredLevel === "string" ? (md.preferredLevel as string) : null,
          onboarded: tls.length > 0,
          openedStory: openedBy.has(u.id),
          listenedSeconds: secs,
          listened: audioBy.has(u.id) || secs > 0,
          completedStory: completedBy.has(u.id),
          viewedPlans: plansBy.has(u.id),
          paid: paidBy.has(u.id),
          platform: platformFor(u),
        };
      });

    const C = cohort.length;
    const funnel = {
      signups: C,
      onboarded: recent.filter((r) => r.onboarded).length,
      openedStory: recent.filter((r) => r.openedStory).length,
      listened: recent.filter((r) => r.listened).length,
      viewedPlans: recent.filter((r) => r.viewedPlans).length,
      paid: recent.filter((r) => r.paid).length,
    };

    const payload = {
      source: "clerk" as const,
      windowDays: days,
      signups: {
        totalAllTime: totalExternal,
        last7d: signupsLast7d,
        last30d: signupsLast30d,
        inWindow: C,
        byPlatform: {
          ios: recent.filter((r) => r.platform === "ios").length,
          web: recent.filter((r) => r.platform === "web").length,
          unknown: recent.filter((r) => r.platform === null).length,
        },
      },
      funnel,
      recent: recent.slice(0, 50),
      clerkInstance: (process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_live_") ? "production" : "development",
    };

    cache = { key: cacheKey, at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("❌ /api/metrics/acquisition error:", err);
    return NextResponse.json(
      { error: "Failed to load acquisition data", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
