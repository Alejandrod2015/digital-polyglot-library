// Weekly metrics digest sent every Monday at 08:00 UTC (~10am Madrid CEST).
// Builds a small HTML email with the founder-facing signals: signups,
// activity, audio engagement, top stories, and one section on errors.

import { Resend } from "resend";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });

// Internal users to exclude from "real user" metrics. Three sources,
// combined and deduped:
//   1. dp_studio_members table (admins/managers/creators) → resolved via
//      Clerk users.getUserList({ emailAddress: [...] }).
//   2. METRICS_INTERNAL_EMAILS env var (comma-separated) → same Clerk
//      resolution; for staff not in studio yet (contractors etc).
//   3. METRICS_INTERNAL_USER_IDS env var (comma-separated Clerk userIds)
//      → direct exclusion, no Clerk lookup. Safety net for power-users
//      whose email-to-userId resolution fails or who use multiple
//      accounts.
async function getInternalUserIds(): Promise<string[]> {
  const studioRows = await prisma.studioMember.findMany({ select: { email: true } });
  const envEmailExtra = (process.env.METRICS_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const directUserIds = (process.env.METRICS_INTERNAL_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const emails = [
    ...new Set([
      ...studioRows.map((r) => r.email.toLowerCase()),
      ...envEmailExtra,
    ]),
  ];
  let emailResolved: string[] = [];
  if (emails.length && process.env.CLERK_SECRET_KEY) {
    try {
      const res = await clerkClient.users.getUserList({
        emailAddress: emails,
        limit: 200,
      });
      emailResolved = res.data.map((u) => u.id);
    } catch {
      // Swallow: a failed Clerk lookup must not break the digest.
    }
  }
  return [...new Set([...emailResolved, ...directUserIds])];
}

type ClerkNameRow = { id: string; firstName: string | null; lastName: string | null };

async function getClerkNames(userIds: string[]): Promise<Map<string, ClerkNameRow>> {
  if (!userIds.length || !process.env.CLERK_SECRET_KEY) return new Map();
  try {
    const res = await clerkClient.users.getUserList({ userId: userIds, limit: 200 });
    return new Map(
      res.data.map((u) => [
        u.id,
        { id: u.id, firstName: u.firstName, lastName: u.lastName },
      ]),
    );
  } catch {
    return new Map();
  }
}

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

type DigestData = {
  weekStart: Date;
  weekEnd: Date;
  signupsThisWeek: number;
  signupsPriorWeek: number;
  newSignups: Array<{
    email: string | null;
    name: string | null;
    createdAt: Date;
    userId: string;
  }>;
  activeUsersThisWeek: number;
  activeUsersPriorWeek: number;
  playsThisWeek: number;
  playsPriorWeek: number;
  completionsThisWeek: number;
  completionsPriorWeek: number;
  vocabClicksThisWeek: number;
  vocabClicksPriorWeek: number;
  vocabSavesThisWeek: number;
  topStories: Array<{ slug: string; title: string; plays: number; completions: number }>;
  newSignupCompletedStory: number; // signups who opened ≥1 story
  internalExcludedCount: number;
};

export async function buildWeeklyDigest(now: Date = new Date()): Promise<DigestData> {
  const weekEnd = now;
  const weekStart = new Date(now.getTime() - 7 * MS_PER_DAY);
  const priorWeekStart = new Date(now.getTime() - 14 * MS_PER_DAY);

  const internalUserIds = await getInternalUserIds();
  const excludeFilter =
    internalUserIds.length > 0 ? { userId: { notIn: internalUserIds } } : {};

  const [
    signupRowsThisWeek,
    signupCountPriorWeek,
    weeklyEvents,
    priorWeekEvents,
  ] = await Promise.all([
    prisma.userMetric.findMany({
      where: {
        eventType: "signup_completed",
        createdAt: { gte: weekStart, lte: weekEnd },
        ...excludeFilter,
      },
      select: { userId: true, createdAt: true, metadata: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userMetric.count({
      where: {
        eventType: "signup_completed",
        createdAt: { gte: priorWeekStart, lt: weekStart },
        ...excludeFilter,
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
        ...excludeFilter,
      },
      select: { eventType: true, userId: true, storySlug: true, bookSlug: true, createdAt: true },
    }),
    // Same window shape as `weeklyEvents`, shifted -7d. Lets us compute
    // vs-prior-week deltas for every activity metric, not only signups.
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: priorWeekStart, lt: weekStart },
        eventType: { in: ["audio_play", "audio_complete", "vocab_clicked"] },
        ...excludeFilter,
      },
      select: { eventType: true, userId: true },
    }),
  ]);

  const events = weeklyEvents as EventRow[];
  const prior = priorWeekEvents as Array<{ eventType: string; userId: string }>;
  const signupRows = signupRowsThisWeek as SignupRow[];

  const playsThisWeek = events.filter((e) => e.eventType === "audio_play").length;
  const completionsThisWeek = events.filter((e) => e.eventType === "audio_complete").length;
  const vocabClicksThisWeek = events.filter((e) => e.eventType === "vocab_clicked").length;
  const vocabSavesThisWeek = events.filter((e) => e.eventType === "vocab_marked_known").length;
  const activeUsersThisWeek = new Set(events.map((e) => e.userId)).size;

  const playsPriorWeek = prior.filter((e) => e.eventType === "audio_play").length;
  const completionsPriorWeek = prior.filter((e) => e.eventType === "audio_complete").length;
  const vocabClicksPriorWeek = prior.filter((e) => e.eventType === "vocab_clicked").length;
  const activeUsersPriorWeek = new Set(prior.map((e) => e.userId)).size;

  // Fetch live names from Clerk for the new signups. The webhook only
  // stored email in metadata; first/last name come from Clerk's user
  // record (the user may have set them after signup).
  const newSignupIdsForNames = signupRows.map((r) => r.userId);
  const namesById = await getClerkNames(newSignupIdsForNames);

  const newSignups = signupRows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const nameRow = namesById.get(row.userId);
    const fullName = nameRow
      ? [nameRow.firstName, nameRow.lastName].filter(Boolean).join(" ") || null
      : null;
    return {
      userId: row.userId,
      email: typeof meta?.email === "string" ? meta.email : null,
      name: fullName,
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
  const topStoriesRaw = Array.from(byStory.entries())
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 5);

  // Resolve human-readable titles so the email reads as "Asado y misterio en
  // la Costanera" instead of "asado-y-misterio-en-la-costanera".
  const titleRows = topStoriesRaw.length
    ? await prisma.journeyStory.findMany({
        where: { slug: { in: topStoriesRaw.map((s) => s.slug) } },
        select: { slug: true, title: true },
      })
    : [];
  const titleBySlug = new Map(
    titleRows
      .filter((r): r is { slug: string; title: string } => !!r.slug && !!r.title)
      .map((r) => [r.slug, r.title]),
  );
  const topStories = topStoriesRaw.map((s) => ({
    ...s,
    title: titleBySlug.get(s.slug) ?? s.slug,
  }));

  return {
    weekStart,
    weekEnd,
    signupsThisWeek: signupRows.length,
    signupsPriorWeek: signupCountPriorWeek,
    newSignups,
    activeUsersThisWeek,
    activeUsersPriorWeek,
    playsThisWeek,
    playsPriorWeek,
    completionsThisWeek,
    completionsPriorWeek,
    vocabClicksThisWeek,
    vocabClicksPriorWeek,
    vocabSavesThisWeek,
    topStories,
    newSignupCompletedStory,
    internalExcludedCount: internalUserIds.length,
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
  const hasSignups = d.signupsThisWeek > 0;
  const activationPct = hasSignups
    ? Math.round((d.newSignupCompletedStory / d.signupsThisWeek) * 100)
    : 0;

  // New signups now render as a small card per user: name on top (or
  // "(no name)" if Clerk has nothing), email + timestamp underneath.
  // Keeps everything scannable on a phone Monday morning.
  const signupsBlock = hasSignups
    ? d.newSignups
        .map((s) => {
          const when = s.createdAt.toISOString().slice(0, 16).replace("T", " ");
          const name = s.name
            ? `<strong>${escapeHtml(s.name)}</strong>`
            : `<span style="color:#9aa7bd">(no name set)</span>`;
          const email = s.email
            ? `<a href="mailto:${escapeHtml(s.email)}" style="color:#2563eb;text-decoration:none">${escapeHtml(s.email)}</a>`
            : `<span style="color:#9aa7bd">(no email)</span>`;
          return `<div style="margin:0 0 10px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafbfc">
            <div style="font-size:13px;margin:0 0 2px">${name}</div>
            <div style="font-size:12px;color:#6b7280">${email} <span style="color:#9aa7bd">· ${when}</span></div>
          </div>`;
        })
        .join("")
    : `<p style="color:#9aa7bd;font-size:13px;margin:0">No new signups this week.</p>`;

  // Top-stories block intentionally avoids <ul>/<li>: Gmail's email-render
  // path occasionally reflows long slugs onto a second line after the bullet,
  // which used to produce a phantom empty bullet above each row. Manual rows
  // keep one line per story regardless of width.
  const topStoriesBlock = d.topStories.length
    ? d.topStories
        .map(
          (s) =>
            `<div style="margin:0 0 6px;font-size:13px"><span style="color:#9aa7bd;margin-right:6px">·</span><strong>${escapeHtml(s.title)}</strong> <span style="color:#6b7280">- ${s.plays} plays / ${s.completions} completions</span></div>`,
        )
        .join("")
    : `<p style="color:#9aa7bd;font-size:13px;margin:0">No plays this week.</p>`;

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
  ${
    hasSignups
      ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px"><strong>${d.newSignupCompletedStory}/${d.signupsThisWeek}</strong> activated (opened ≥1 story): <strong>${activationPct}%</strong></p>`
      : ""
  }
  ${signupsBlock}

  <h2 style="font-size:15px;margin:24px 0 8px;color:#0b1220">Activity</h2>
  <div style="margin:0 0 6px;font-size:13px"><span style="color:#9aa7bd;margin-right:6px">·</span><strong>${d.activeUsersThisWeek}</strong> active users ${delta(d.activeUsersThisWeek, d.activeUsersPriorWeek)} <span style="color:#9aa7bd">(vs ${d.activeUsersPriorWeek})</span></div>
  <div style="margin:0 0 6px;font-size:13px"><span style="color:#9aa7bd;margin-right:6px">·</span><strong>${d.playsThisWeek}</strong> audio plays ${delta(d.playsThisWeek, d.playsPriorWeek)} <span style="color:#9aa7bd">(vs ${d.playsPriorWeek})</span>, <strong>${d.completionsThisWeek}</strong> completions ${delta(d.completionsThisWeek, d.completionsPriorWeek)} <span style="color:#9aa7bd">(vs ${d.completionsPriorWeek})</span></div>
  <div style="margin:0 0 16px;font-size:13px"><span style="color:#9aa7bd;margin-right:6px">·</span><strong>${d.vocabClicksThisWeek}</strong> vocab taps ${delta(d.vocabClicksThisWeek, d.vocabClicksPriorWeek)} <span style="color:#9aa7bd">(vs ${d.vocabClicksPriorWeek})</span>, <strong>${d.vocabSavesThisWeek}</strong> marked known</div>

  <h2 style="font-size:15px;margin:24px 0 8px;color:#0b1220">Top stories this week</h2>
  ${topStoriesBlock}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px"/>
  <p style="color:#9aa7bd;font-size:11px;margin:0 0 4px">
    You're receiving this because you set up the weekly digest cron.
    Reply to this email to change cadence or thresholds.
  </p>
  ${
    d.internalExcludedCount > 0
      ? `<p style="color:#9aa7bd;font-size:11px;margin:0">Excluding ${d.internalExcludedCount} internal user${d.internalExcludedCount === 1 ? "" : "s"} (studio members + METRICS_INTERNAL_EMAILS).</p>`
      : `<p style="color:#9aa7bd;font-size:11px;margin:0">No internal-user exclude list configured. Add studio members or set METRICS_INTERNAL_EMAILS to filter out staff sessions.</p>`
  }
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
      (s) =>
        `  - ${s.name ?? "(no name)"} <${s.email ?? "(no email)"}> ${s.createdAt.toISOString()}`,
    ),
    ``,
    `ACTIVITY`,
    `  active users: ${d.activeUsersThisWeek} (prior: ${d.activeUsersPriorWeek})`,
    `  plays: ${d.playsThisWeek}, completions: ${d.completionsThisWeek}`,
    `  vocab taps: ${d.vocabClicksThisWeek}, saves: ${d.vocabSavesThisWeek}`,
    ``,
    `TOP STORIES`,
    ...d.topStories.map(
      (s) => `  - ${s.title}: ${s.plays} plays / ${s.completions} completions`,
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
