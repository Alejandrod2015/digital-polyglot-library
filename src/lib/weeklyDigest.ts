// Weekly metrics digest sent every Monday at 08:00 UTC (~10am Madrid CEST).
// Builds a small HTML email with the founder-facing signals: signups,
// activity, audio engagement, top stories, and one section on errors.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

type EventRow = {
  eventType: string;
  userId: string;
  storySlug: string;
  bookSlug: string | null;
  createdAt: Date;
};

type SignupRow = {
  userId: string;
  createdAt: Date;
  metadata: unknown;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bullet(rows: string[]): string {
  if (!rows.length) return "<li style=\"color:#9aa7bd\">No data this week.</li>";
  return rows.map((r) => `<li>${r}</li>`).join("");
}

type DigestData = {
  weekStart: Date;
  weekEnd: Date;
  signupsThisWeek: number;
  signupsPriorWeek: number;
  newSignups: Array<{ email: string | null; createdAt: Date; userId: string }>;
  activeUsersThisWeek: number;
  activeUsersPriorWeek: number;
  playsThisWeek: number;
  completionsThisWeek: number;
  vocabClicksThisWeek: number;
  vocabSavesThisWeek: number;
  topStories: Array<{ slug: string; plays: number; completions: number }>;
  newSignupCompletedStory: number; // signups who opened ≥1 story
};

export async function buildWeeklyDigest(now: Date = new Date()): Promise<DigestData> {
  const weekEnd = now;
  const weekStart = new Date(now.getTime() - 7 * MS_PER_DAY);
  const priorWeekStart = new Date(now.getTime() - 14 * MS_PER_DAY);

  const [
    signupRowsThisWeek,
    signupCountPriorWeek,
    weeklyEvents,
    priorWeekUserIds,
  ] = await Promise.all([
    prisma.userMetric.findMany({
      where: {
        eventType: "signup_completed",
        createdAt: { gte: weekStart, lte: weekEnd },
      },
      select: { userId: true, createdAt: true, metadata: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userMetric.count({
      where: {
        eventType: "signup_completed",
        createdAt: { gte: priorWeekStart, lt: weekStart },
      },
    }),
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: weekStart, lte: weekEnd },
        eventType: {
          in: [
            "audio_play",
            "audio_complete",
            "vocab_clicked",
            "vocab_marked_known",
            "vocab_marked_unknown",
            "story_started",
          ],
        },
      },
      select: { eventType: true, userId: true, storySlug: true, bookSlug: true, createdAt: true },
    }),
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: priorWeekStart, lt: weekStart },
        eventType: { in: ["audio_play", "audio_complete", "vocab_clicked"] },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const events = weeklyEvents as EventRow[];
  const signupRows = signupRowsThisWeek as SignupRow[];

  const playsThisWeek = events.filter((e) => e.eventType === "audio_play").length;
  const completionsThisWeek = events.filter((e) => e.eventType === "audio_complete").length;
  const vocabClicksThisWeek = events.filter((e) => e.eventType === "vocab_clicked").length;
  const vocabSavesThisWeek = events.filter((e) => e.eventType === "vocab_marked_known").length;
  const activeUsersThisWeek = new Set(events.map((e) => e.userId)).size;
  const activeUsersPriorWeek = (priorWeekUserIds as Array<{ userId: string }>).length;

  const newSignups = signupRows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    return {
      userId: row.userId,
      email: typeof meta?.email === "string" ? meta.email : null,
      createdAt: row.createdAt,
    };
  });

  const newSignupIds = new Set(newSignups.map((s) => s.userId));
  const newSignupCompletedStory = new Set(
    events.filter((e) => newSignupIds.has(e.userId)).map((e) => e.userId),
  ).size;

  const byStory = new Map<string, { plays: number; completions: number }>();
  for (const e of events) {
    if (e.eventType !== "audio_play" && e.eventType !== "audio_complete") continue;
    const cur = byStory.get(e.storySlug) ?? { plays: 0, completions: 0 };
    if (e.eventType === "audio_play") cur.plays += 1;
    else cur.completions += 1;
    byStory.set(e.storySlug, cur);
  }
  const topStories = Array.from(byStory.entries())
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  return {
    weekStart,
    weekEnd,
    signupsThisWeek: signupRows.length,
    signupsPriorWeek: signupCountPriorWeek,
    newSignups,
    activeUsersThisWeek,
    activeUsersPriorWeek,
    playsThisWeek,
    completionsThisWeek,
    vocabClicksThisWeek,
    vocabSavesThisWeek,
    topStories,
    newSignupCompletedStory,
  };
}

function delta(now: number, prior: number): string {
  if (prior === 0) return now > 0 ? `<span style="color:#22c55e">▲ new</span>` : `→ flat`;
  const diff = now - prior;
  const pct = Math.round((diff / prior) * 100);
  if (diff === 0) return `→ flat`;
  const arrow = diff > 0 ? "▲" : "▼";
  const color = diff > 0 ? "#22c55e" : "#ef4444";
  return `<span style="color:${color}">${arrow} ${Math.abs(pct)}%</span>`;
}

function renderHtml(d: DigestData): string {
  const range = `${fmtDate(d.weekStart)} → ${fmtDate(d.weekEnd)}`;
  const signupsList = d.newSignups
    .map((s) => {
      const when = s.createdAt.toISOString().slice(0, 16).replace("T", " ");
      const email = s.email ?? `<span style="color:#9aa7bd">(no email)</span>`;
      return `<li><strong>${escapeHtml(email)}</strong> <span style="color:#9aa7bd">${when}</span></li>`;
    });
  const topStoriesList = d.topStories.map(
    (s) =>
      `<li><strong>${escapeHtml(s.slug)}</strong> — ${s.plays} plays / ${s.completions} completions</li>`,
  );
  const activationPct =
    d.signupsThisWeek > 0
      ? Math.round((d.newSignupCompletedStory / d.signupsThisWeek) * 100)
      : 0;
  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;color:#0b1220;line-height:1.55">
  <p style="color:#6b7280;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em">Weekly digest</p>
  <h1 style="font-size:22px;margin:0 0 4px;color:#0b1220">Digital Polyglot · ${range}</h1>
  <p style="color:#6b7280;margin:0 0 24px;font-size:13px">All times UTC. <a href="https://www.digitalpolyglot.com/studio/metrics" style="color:#2563eb">Open full dashboard →</a></p>

  <h2 style="font-size:15px;margin:24px 0 8px;color:#0b1220">Signups</h2>
  <p style="margin:0 0 8px">
    <strong>${d.signupsThisWeek}</strong> this week
    ${delta(d.signupsThisWeek, d.signupsPriorWeek)}
    <span style="color:#9aa7bd"> (vs ${d.signupsPriorWeek} prior week)</span>
  </p>
  <p style="margin:0 0 8px;color:#6b7280;font-size:13px">
    <strong>${d.newSignupCompletedStory}/${d.signupsThisWeek}</strong> activated (opened ≥1 story): <strong>${activationPct}%</strong>
  </p>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:13px">${bullet(signupsList)}</ul>

  <h2 style="font-size:15px;margin:24px 0 8px;color:#0b1220">Activity</h2>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:13px">
    <li><strong>${d.activeUsersThisWeek}</strong> active users ${delta(d.activeUsersThisWeek, d.activeUsersPriorWeek)} <span style="color:#9aa7bd">(vs ${d.activeUsersPriorWeek})</span></li>
    <li><strong>${d.playsThisWeek}</strong> audio plays, <strong>${d.completionsThisWeek}</strong> completions</li>
    <li><strong>${d.vocabClicksThisWeek}</strong> vocab taps, <strong>${d.vocabSavesThisWeek}</strong> marked known</li>
  </ul>

  <h2 style="font-size:15px;margin:24px 0 8px;color:#0b1220">Top stories this week</h2>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:13px">${bullet(topStoriesList)}</ul>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px"/>
  <p style="color:#9aa7bd;font-size:11px;margin:0">
    You're receiving this because you set up the weekly digest cron.
    Reply to this email to change cadence or thresholds.
  </p>
</div>`;
}

function renderText(d: DigestData): string {
  const range = `${fmtDate(d.weekStart)} → ${fmtDate(d.weekEnd)}`;
  return [
    `Digital Polyglot weekly digest · ${range}`,
    ``,
    `SIGNUPS`,
    `  ${d.signupsThisWeek} this week (prior: ${d.signupsPriorWeek})`,
    `  activated: ${d.newSignupCompletedStory}/${d.signupsThisWeek}`,
    ...d.newSignups.map(
      (s) => `  - ${s.email ?? "(no email)"} ${s.createdAt.toISOString()}`,
    ),
    ``,
    `ACTIVITY`,
    `  active users: ${d.activeUsersThisWeek} (prior: ${d.activeUsersPriorWeek})`,
    `  plays: ${d.playsThisWeek}, completions: ${d.completionsThisWeek}`,
    `  vocab taps: ${d.vocabClicksThisWeek}, saves: ${d.vocabSavesThisWeek}`,
    ``,
    `TOP STORIES`,
    ...d.topStories.map(
      (s) => `  - ${s.slug}: ${s.plays} plays / ${s.completions} completions`,
    ),
    ``,
    `Full dashboard: https://www.digitalpolyglot.com/studio/metrics`,
  ].join("\n");
}

export async function sendWeeklyDigest(): Promise<
  | { status: "sent"; to: string; data: DigestData }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string }
> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.METRICS_DIGEST_TO ?? "delcarpio321@gmail.com";

  if (!apiKey || !from) {
    return { status: "skipped", reason: "RESEND_API_KEY or EMAIL_FROM not set" };
  }

  const data = await buildWeeklyDigest();
  const subject = `Digital Polyglot weekly · ${data.signupsThisWeek} signups, ${data.activeUsersThisWeek} active`;
  const html = renderHtml(data);
  const text = renderText(data);

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      tags: [
        { name: "type", value: "internal" },
        { name: "category", value: "weekly-digest" },
      ],
    });
    return { status: "sent", to, data };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
