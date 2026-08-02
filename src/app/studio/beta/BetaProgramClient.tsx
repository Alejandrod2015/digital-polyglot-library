"use client";

// The whole beta program on one screen. Five tabs, one data load.
//
// The organizing idea is that you should only ever have to look at two of
// these: Review (what the rules could not decide) and Feedback (what testers
// said). Everything else is there for when you want it, not because the
// program needs you.

import { useCallback, useEffect, useMemo, useState } from "react";

const ACCENT = "#14b8a6";

type Tab = "review" | "testers" | "feedback" | "releases" | "rules";

type Applicant = {
  id: string;
  email: string;
  firstName: string | null;
  appleIdEmail: string | null;
  socialHandle: string | null;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string;
  hasIPhone: boolean;
  weeklyHours: string | null;
  motivation: string | null;
  referralSource: string | null;
  applicationReason: string | null;
  status: string;
  score: number | null;
  decision: string | null;
  decisionReason: string | null;
  notes: string | null;
  invitedAt: string | null;
  ascError: string | null;
  clerkUserId: string | null;
  lastActiveAt: string | null;
  planGrantedAt: string | null;
  createdAt: string;
  _count?: { feedback: number };
  /** Real usage from UserMetric. Null until the tester has signed in. */
  usage?: {
    stories: number;
    audioPlays: number;
    audioCompletes: number;
    practice: number;
    lastEventAt: string | null;
  } | null;
};

type Feedback = {
  id: string;
  email: string;
  kind: string;
  rating: number | null;
  message: string;
  screen: string | null;
  platform: string;
  appVersion: string | null;
  buildNumber: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  status: string;
  adminNotes: string | null;
  releaseId: string | null;
  createdAt: string;
  signup: { id: string; firstName: string | null; email: string } | null;
};

type Release = {
  id: string;
  platform: string;
  version: string;
  buildNumber: string;
  headline: string;
  whatsNew: string[];
  knownIssues: string[] | null;
  askThem: string | null;
  status: string;
  publishedAt: string | null;
  notifiedCount: number;
  createdAt: string;
};

type Rules = {
  autoAcceptAt: number;
  autoDeclineBelow: number;
  maxActiveTesters: number;
  acceptedTargetLanguages: string[];
  autoInviteEnabled: boolean;
  betaEndsAt: string | null;
  launchedAt: string | null;
  appStoreReviewUrl: string | null;
  installNudgeAfterDays: number;
  feedbackAskAfterDays: number;
  midSurveyAfterDays: number;
  finalSurveyBeforeEndDays: number;
  reviewAskMinRating: number;
};

type Payload = {
  applicants: Applicant[];
  feedback: Feedback[];
  releases: Release[];
  rules: Rules;
  stats: { activeTesters: number; byStatus: Record<string, number>; openFeedback: number };
  health: { ok: true; groups: Array<{ id: string; name: string; internal: boolean }> } | { ok: false; error: string } | null;
};

/* ── shared styles, matching the rest of Studio ── */

const card: React.CSSProperties = {
  borderRadius: 10,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  padding: "14px 16px",
};

const btn: React.CSSProperties = {
  height: 32,
  borderRadius: 6,
  border: "none",
  backgroundColor: ACCENT,
  color: "#fff",
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  ...btn,
  backgroundColor: "transparent",
  border: "1px solid var(--card-border)",
  color: "var(--muted)",
};

const dangerBtn: React.CSSProperties = { ...ghostBtn, color: "#f87171", borderColor: "#f8717155" };

const inputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

const areaStyle: React.CSSProperties = { ...inputStyle, height: 80, padding: "8px 10px", lineHeight: 1.5 };

const STATUS_COLORS: Record<string, string> = {
  pending: "#fbbf24",
  waitlist: "#a78bfa",
  invited: "#60a5fa",
  accepted: "#34d399",
  declined: "#f87171",
  new: "#fbbf24",
  triaged: "#a78bfa",
  in_progress: "#60a5fa",
  fixed: "#34d399",
  wont_fix: "#9aa7bd",
  duplicate: "#9aa7bd",
  draft: "#fbbf24",
  published: "#34d399",
};

function pill(value: string): React.CSSProperties {
  const color = STATUS_COLORS[value] ?? "#9aa7bd";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: `${color}26`,
    color,
    whiteSpace: "nowrap",
  };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** One usage number with its label, sized so a row of them scans at a glance. */
function Metric({ n, label }: { n: number; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <b style={{ fontSize: 15, color: n > 0 ? ACCENT : "var(--muted)" }}>{n}</b>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
    </span>
  );
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" };
}

/* ── component ── */

export default function BetaProgramClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (withHealth = false) => {
    try {
      const res = await fetch(`/api/studio/beta${withHealth ? "?health=1" : ""}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 6000);
  }, []);

  const applicantAction = useCallback(
    async (id: string, action: string, extra: Record<string, unknown> = {}) => {
      setBusy(id);
      try {
        const res = await fetch("/api/studio/beta/applicants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, ...extra }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? json.inviteError ?? `HTTP ${res.status}`);
        say(`Done: ${action}`);
        await load();
      } catch (err) {
        say(`Failed: ${String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [load, say],
  );

  const feedbackPatch = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setBusy(id);
      try {
        const res = await fetch("/api/studio/beta/feedback", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        await load();
      } catch (err) {
        say(`Failed: ${String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [load, say],
  );

  if (loading) return <div style={{ color: "var(--muted)", padding: 24 }}>Loading the beta program...</div>;
  if (error) return <div style={{ color: "#f87171", padding: 24 }}>{error}</div>;
  if (!data) return null;

  const needsReview = data.applicants.filter((a) => a.status === "waitlist" || a.status === "pending");
  const testers = data.applicants.filter((a) => a.status === "invited" || a.status === "accepted");

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "review", label: "Review queue", count: needsReview.length },
    { key: "testers", label: "Testers", count: testers.length },
    { key: "feedback", label: "Feedback", count: data.stats.openFeedback },
    { key: "releases", label: "Build notes", count: data.releases.length },
    { key: "rules", label: "Rules" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatBar stats={data.stats} rules={data.rules} />

      {flash && (
        <div style={{ ...card, borderColor: ACCENT, color: "var(--foreground)", fontSize: 13 }}>{flash}</div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...ghostBtn,
              backgroundColor: tab === t.key ? `${ACCENT}22` : "transparent",
              borderColor: tab === t.key ? ACCENT : "var(--card-border)",
              color: tab === t.key ? ACCENT : "var(--muted)",
            }}
          >
            {t.label}
            {t.count !== undefined && ` (${t.count})`}
          </button>
        ))}
      </div>

      {tab === "review" && (
        <ReviewQueue
          applicants={needsReview}
          busy={busy}
          onAction={applicantAction}
        />
      )}

      {tab === "testers" && <Testers testers={testers} busy={busy} onAction={applicantAction} />}

      {tab === "feedback" && (
        <FeedbackList
          feedback={data.feedback}
          releases={data.releases}
          busy={busy}
          onPatch={feedbackPatch}
        />
      )}

      {tab === "releases" && (
        <Releases releases={data.releases} onChanged={load} say={say} testerCount={testers.length} />
      )}

      {tab === "rules" && (
        <RulesPanel rules={data.rules} health={data.health} onReload={load} say={say} />
      )}
    </div>
  );
}

/* ── stat bar ── */

function StatBar({ stats, rules }: { stats: Payload["stats"]; rules: Rules }) {
  const items = [
    { label: "Active testers", value: `${stats.activeTesters} / ${rules.maxActiveTesters}` },
    { label: "Needs review", value: String((stats.byStatus.waitlist ?? 0) + (stats.byStatus.pending ?? 0)) },
    { label: "Open feedback", value: String(stats.openFeedback) },
    { label: "Auto-invite", value: rules.autoInviteEnabled ? "On" : "Off" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      {items.map((i) => (
        <div key={i.label} style={card}>
          <div style={labelStyle()}>{i.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{i.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── review queue ── */

function ReviewQueue({
  applicants,
  busy,
  onAction,
}: {
  applicants: Applicant[];
  busy: string | null;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  if (applicants.length === 0) {
    return (
      <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>
        Nothing waiting. The rules handled everything that came in.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {applicants.map((a) => (
        <div key={a.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {a.firstName ?? "(no name)"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{a.email}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                {a.targetLanguage} · {a.currentLevel} · {a.weeklyHours ?? "?"} hrs/wk · {a.motivation ?? "?"} · via {a.referralSource ?? "?"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={pill(a.status)}>{a.status}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{a.score ?? "-"}</span>
            </div>
          </div>

          {a.decisionReason && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
              Rules said: {a.decisionReason}
            </div>
          )}

          {a.ascError && (
            <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>
              App Store Connect: {a.ascError}
            </div>
          )}

          {a.applicationReason && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                backgroundColor: "var(--background)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {a.applicationReason}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button style={btn} disabled={busy === a.id} onClick={() => onAction(a.id, "invite")}>
              {busy === a.id ? "Working..." : "Invite to TestFlight"}
            </button>
            <button style={ghostBtn} disabled={busy === a.id} onClick={() => onAction(a.id, "retriage")}>
              Re-run rules
            </button>
            <button style={dangerBtn} disabled={busy === a.id} onClick={() => onAction(a.id, "decline")}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── testers ── */

function Testers({
  testers,
  busy,
  onAction,
}: {
  testers: Applicant[];
  busy: string | null;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  if (testers.length === 0) {
    return <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>No testers yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {testers.map((t) => {
        // An invite that was accepted but never signed in is the single most
        // common silent failure in a beta, so it is called out by name.
        const stalled = t.status === "invited" && !t.clerkUserId;
        return (
          <div key={t.id} style={{ ...card, borderColor: stalled ? "#fbbf2455" : "var(--card-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t.firstName ?? "(no name)"}{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>{t.email}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {t.targetLanguage} · invited {ago(t.invitedAt)} · {t._count?.feedback ?? 0} reports
                </div>
                {/* What they actually did, not just that they opened the app.
                    Absent until they sign in, which is itself the signal. */}
                {t.usage ? (
                  <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                    <Metric n={t.usage.stories} label="stories" />
                    <Metric n={t.usage.audioPlays} label="plays" />
                    <Metric n={t.usage.audioCompletes} label="finished" />
                    <Metric n={t.usage.practice} label="practice" />
                    <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "flex-end" }}>
                      last used {ago(t.usage.lastEventAt)}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                    No usage yet: has not signed in.
                  </div>
                )}
                {stalled && (
                  <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 4 }}>
                    Invited but never signed in. The lifecycle cron will nudge them.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={pill(t.status)}>{t.status}</span>
                <button style={dangerBtn} disabled={busy === t.id} onClick={() => onAction(t.id, "remove")}>
                  Remove access
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── feedback ── */

const FEEDBACK_STATUSES = ["new", "triaged", "in_progress", "fixed", "wont_fix", "duplicate"];

function FeedbackList({
  feedback,
  releases,
  busy,
  onPatch,
}: {
  feedback: Feedback[];
  releases: Release[];
  busy: string | null;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(
    () => (showAll ? feedback : feedback.filter((f) => f.status === "new" || f.status === "triaged" || f.status === "in_progress")),
    [feedback, showAll],
  );
  const drafts = releases.filter((r) => r.status === "draft");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button style={ghostBtn} onClick={() => setShowAll((v) => !v)}>
        {showAll ? "Show only open" : `Show all (${feedback.length})`}
      </button>

      {visible.length === 0 && (
        <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>Nothing open.</div>
      )}

      {visible.map((f) => (
        <div key={f.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {f.signup?.firstName ?? f.email} · {f.platform} {f.appVersion ?? ""}
              {f.buildNumber ? ` (build ${f.buildNumber})` : ""} · {f.screen ?? "unknown screen"} · {ago(f.createdAt)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={pill(f.kind)}>{f.kind}</span>
              {f.rating !== null && <span style={pill("triaged")}>{f.rating}</span>}
              <span style={pill(f.status)}>{f.status}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              backgroundColor: "var(--background)",
              fontSize: 13.5,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {f.message}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={f.status}
              disabled={busy === f.id}
              onChange={(e) => onPatch(f.id, { status: e.target.value })}
              style={{ ...inputStyle, width: 150 }}
            >
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Attaching a report to a draft build is what makes the build
                note tell this tester, by name, that their report shipped. */}
            <select
              value={f.releaseId ?? ""}
              disabled={busy === f.id || drafts.length === 0}
              onChange={(e) => onPatch(f.id, { releaseId: e.target.value || null })}
              style={{ ...inputStyle, width: 230 }}
            >
              <option value="">Not fixed in a build yet</option>
              {drafts.map((r) => (
                <option key={r.id} value={r.id}>
                  Fixed in build {r.buildNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── releases ── */

function Releases({
  releases,
  onChanged,
  say,
  testerCount,
}: {
  releases: Release[];
  onChanged: () => Promise<void>;
  say: (msg: string) => void;
  testerCount: number;
}) {
  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [headline, setHeadline] = useState("");
  const [whatsNew, setWhatsNew] = useState("");
  const [knownIssues, setKnownIssues] = useState("");
  const [askThem, setAskThem] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  async function create() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/beta/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          buildNumber,
          headline,
          whatsNew: lines(whatsNew),
          knownIssues: lines(knownIssues),
          askThem: askThem.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setVersion("");
      setBuildNumber("");
      setHeadline("");
      setWhatsNew("");
      setKnownIssues("");
      setAskThem("");
      say("Draft build note created.");
      await onChanged();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function publish(r: Release) {
    // The one irreversible action on this screen. Confirming names the real
    // number of people it will reach.
    if (
      !window.confirm(
        `Send the build ${r.buildNumber} note to ${testerCount} tester${testerCount === 1 ? "" : "s"} by email and push? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPublishing(r.id);
    try {
      const res = await fetch("/api/studio/beta/releases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say(
        `Build ${r.buildNumber}: ${json.emailed} emailed, ${json.pushed} pushed${
          json.pushSkippedReason ? ` (push skipped: ${json.pushSkippedReason})` : ""
        }${json.emailFailed ? `, ${json.emailFailed} failed` : ""}.`,
      );
      await onChanged();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 10 }}>New build note</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={inputStyle} placeholder="Version (1.2.0)" value={version} onChange={(e) => setVersion(e.target.value)} />
          <input style={inputStyle} placeholder="Build number (279)" value={buildNumber} onChange={(e) => setBuildNumber(e.target.value)} />
        </div>
        <input
          style={{ ...inputStyle, marginTop: 10 }}
          placeholder="Headline (Audio starts instantly now)"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>What changed (one per line)</div>
        <textarea style={areaStyle} value={whatsNew} onChange={(e) => setWhatsNew(e.target.value)} />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>Known issues (one per line, optional)</div>
        <textarea style={areaStyle} value={knownIssues} onChange={(e) => setKnownIssues(e.target.value)} />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>If they only do one thing</div>
        <input style={inputStyle} value={askThem} onChange={(e) => setAskThem(e.target.value)} placeholder="Open a story and skip forward twice" />
        <button style={{ ...btn, marginTop: 12 }} disabled={saving} onClick={create}>
          {saving ? "Saving..." : "Create draft"}
        </button>
      </div>

      {releases.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Build {r.buildNumber} <span style={{ color: "var(--muted)", fontWeight: 500 }}>v{r.version}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{r.headline}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={pill(r.status)}>{r.status}</span>
              {r.status === "draft" && (
                <button style={btn} disabled={publishing === r.id} onClick={() => publish(r)}>
                  {publishing === r.id ? "Sending..." : "Publish and notify"}
                </button>
              )}
            </div>
          </div>
          {r.status === "published" && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Sent to {r.notifiedCount} testers {ago(r.publishedAt)}
            </div>
          )}
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            {r.whatsNew.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── rules ── */

function RulesPanel({
  rules,
  health,
  onReload,
  say,
}: {
  rules: Rules;
  health: Payload["health"];
  onReload: (withHealth?: boolean) => Promise<void>;
  say: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<Rules>(rules);
  const [saving, setSaving] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => setDraft(rules), [rules]);

  async function createGroup() {
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/studio/beta", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say(json.created ? `Created the "${json.name}" group.` : `"${json.name}" already existed.`);
      await onReload(true);
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setCreatingGroup(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/beta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say("Rules saved.");
      await onReload();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const num = (key: keyof Rules, label: string, hint: string) => (
    <div key={key}>
      <div style={labelStyle()}>{label}</div>
      <input
        style={{ ...inputStyle, marginTop: 4 }}
        type="number"
        value={String(draft[key] ?? 0)}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>
    </div>
  );

  const dateField = (key: "betaEndsAt" | "launchedAt", label: string, hint: string) => (
    <div key={key}>
      <div style={labelStyle()}>{label}</div>
      <input
        style={{ ...inputStyle, marginTop: 4 }}
        type="date"
        value={draft[key] ? new Date(draft[key] as string).toISOString().slice(0, 10) : ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value || null })}
      />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>App Store Connect</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {health === null
                ? "Not checked yet."
                : health.ok
                  ? `Connected. Groups: ${health.groups.map((g) => `${g.name}${g.internal ? " (internal)" : ""}`).join(", ") || "none"}`
                  : `Not working: ${health.error}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={ghostBtn} onClick={() => onReload(true)}>
              Check connection
            </button>
            <button style={ghostBtn} disabled={creatingGroup} onClick={createGroup}>
              {creatingGroup ? "Working..." : "Create beta group"}
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.autoInviteEnabled}
            onChange={(e) => setDraft({ ...draft, autoInviteEnabled: e.target.checked })}
          />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Auto-invite is on</span>
        </label>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          Off means every application waits for you, however good it is.
        </div>
      </div>

      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 12 }}>Thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {num("autoAcceptAt", "Auto-accept at", "Score at or above this is invited with no review.")}
          {num("autoDeclineBelow", "Auto-decline below", "Score under this is declined with no review.")}
          {num("maxActiveTesters", "Tester cap", "Good applicants waitlist once this many are active.")}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 12 }}>Schedule</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {num("installNudgeAfterDays", "Install nudge", "Days after the invite with no sign-in.")}
          {num("feedbackAskAfterDays", "Feedback ask", "Days after a tester starts.")}
          {num("midSurveyAfterDays", "Halfway survey", "Days after a tester starts.")}
          {num("finalSurveyBeforeEndDays", "Final survey", "Days before the beta ends.")}
          {dateField("betaEndsAt", "Beta ends", "Empty means the final survey never fires.")}
          {dateField("launchedAt", "Launched on", "Empty means the review ask never fires.")}
          {num("reviewAskMinRating", "Review ask at", "Final rating at or above this gets the review ask.")}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={labelStyle()}>App Store review link</div>
          <input
            style={{ ...inputStyle, marginTop: 4 }}
            value={draft.appStoreReviewUrl ?? ""}
            placeholder="https://apps.apple.com/app/id.../?action=write-review"
            onChange={(e) => setDraft({ ...draft, appStoreReviewUrl: e.target.value || null })}
          />
        </div>
      </div>

      <div style={card}>
        <div style={labelStyle()}>Recruiting for (comma separated)</div>
        <input
          style={{ ...inputStyle, marginTop: 4 }}
          value={draft.acceptedTargetLanguages.join(", ")}
          onChange={(e) =>
            setDraft({ ...draft, acceptedTargetLanguages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
        />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          Applications for anything else queue for review instead of being auto-invited.
        </div>
      </div>

      <button style={btn} disabled={saving} onClick={save}>
        {saving ? "Saving..." : "Save rules"}
      </button>
    </div>
  );
}
