"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import StudioShell from "@/components/studio/StudioShell";

const MetricsOverviewChart = dynamic(
  () => import("@/components/studio/MetricsOverviewChart"),
  {
    ssr: false,
    loading: () => <div className="studio-skeleton" style={{ height: 320, width: "100%" }} />,
  }
);

const MetricsEngagementChart = dynamic(
  () => import("@/components/studio/MetricsEngagementChart"),
  {
    ssr: false,
    loading: () => <div className="studio-skeleton" style={{ height: 400, width: "100%" }} />,
  }
);

type MetricsSection =
  | "overview"
  | "acquisition"
  | "engagement"
  | "learning"
  | "content"
  | "funnels"
  | "audience"
  | "experiments"
  | "alerts"
  | "exports";

type DashboardData = {
  range: { from: string; to: string; days: number };
  kpis: {
    dau: number; wau: number; activeUsersInRange: number; plays: number;
    completions: number; completionRate: number; uniqueStories: number;
    uniqueBooks: number; avgMinutesPerActiveUser: number; totalListenedMinutes: number;
    savedStories: number; savedBooks: number;
  };
  daily: Array<{ date: string; plays: number; completions: number; completionRate: number }>;
  topStories: Array<{ storySlug: string; plays: number; completions: number; completionRate: number }>;
  topBooks: Array<{ bookSlug: string; plays: number; completions: number; completionRate: number }>;
  topStoriesByMinutes: Array<{ storySlug: string; listenedMinutes: number; listeners: number }>;
  topSavedStories: Array<{ storySlug: string; saves: number }>;
  topSavedBooks: Array<{ bookSlug: string; saves: number }>;
  trialFunnel: {
    started: number; startedWithPm: number; day1Active: number; converted: number;
    canceled: number; conversionRate: number; day1ActivationRate: number; cancelRate: number;
  };
  recentTrialStarts: Array<{ userId: string; email: string | null; eventType: string; createdAt: string }>;
  recentReminderTaps: Array<{ userId: string; email: string | null; eventType: string; destination: string | null; source: string | null; createdAt: string }>;
  recentReminderOpens: Array<{ userId: string; email: string | null; eventType: string; destination: string | null; createdAt: string }>;
  checkoutFunnel: {
    plansViewed: number; checkoutStarted: number; checkoutRedirected: number;
    checkoutFailed: number; checkoutStartRate: number; checkoutRedirectRate: number;
  };
  upgradeCtaSources: Array<{ source: string; clicks: number }>;
  journeyFunnel: {
    variantSelected: number; levelSelected: number; topicOpened: number;
    nextActionClicked: number; reviewCtaClicked: number; checkpointRecoveryClicked: number;
    recommendedModeOpened: number; topicOpenRateFromVariant: number;
    nextActionRateFromTopicOpen: number; reviewRateFromTopicOpen: number;
  };
  reminderFunnel: {
    scheduled: number; tapped: number; destinationOpened: number;
    tapRateFromScheduled: number; openRateFromTap: number;
    destinationBreakdown: Array<{ destination: string; opens: number }>;
  };
};

const EMPTY_DATA: DashboardData = {
  range: { from: "", to: "", days: 30 },
  kpis: { dau: 0, wau: 0, activeUsersInRange: 0, plays: 0, completions: 0, completionRate: 0, uniqueStories: 0, uniqueBooks: 0, avgMinutesPerActiveUser: 0, totalListenedMinutes: 0, savedStories: 0, savedBooks: 0 },
  daily: [], topStories: [], topBooks: [], topStoriesByMinutes: [], topSavedStories: [], topSavedBooks: [],
  trialFunnel: { started: 0, startedWithPm: 0, day1Active: 0, converted: 0, canceled: 0, conversionRate: 0, day1ActivationRate: 0, cancelRate: 0 },
  recentTrialStarts: [], recentReminderTaps: [], recentReminderOpens: [],
  checkoutFunnel: { plansViewed: 0, checkoutStarted: 0, checkoutRedirected: 0, checkoutFailed: 0, checkoutStartRate: 0, checkoutRedirectRate: 0 },
  upgradeCtaSources: [],
  journeyFunnel: { variantSelected: 0, levelSelected: 0, topicOpened: 0, nextActionClicked: 0, reviewCtaClicked: 0, checkpointRecoveryClicked: 0, recommendedModeOpened: 0, topicOpenRateFromVariant: 0, nextActionRateFromTopicOpen: 0, reviewRateFromTopicOpen: 0 },
  reminderFunnel: { scheduled: 0, tapped: 0, destinationOpened: 0, tapRateFromScheduled: 0, openRateFromTap: 0, destinationBreakdown: [] },
};

/* ── shared style tokens ── */
const card: React.CSSProperties = { borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 };
const cardCompact: React.CSSProperties = { ...card, padding: 16 };
const input: React.CSSProperties = { height: 40, width: "100%", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 12px", fontSize: 14, outline: "none" };
const btnPrimary: React.CSSProperties = { height: 40, borderRadius: 8, border: "none", backgroundColor: "var(--primary)", color: "#fff", padding: "0 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em" };
const heading: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "0 0 14px" };
const kpiValue: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: "var(--foreground)", margin: "6px 0 0", lineHeight: 1.2 };
const kpiLabel: React.CSSProperties = { fontSize: 13, color: "var(--muted)", fontWeight: 500 };
const subLabel: React.CSSProperties = { fontSize: 12, color: "var(--muted)", marginTop: 2 };
const emptyText: React.CSSProperties = { fontSize: 13, color: "var(--muted)" };
const listRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", fontSize: 13 };
const thStyle: React.CSSProperties = { padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--muted)", textAlign: "left" as const, borderBottom: "1px solid var(--card-border)" };
const tdStyle: React.CSSProperties = { padding: "8px 12px", fontSize: 13, color: "var(--foreground)", borderBottom: "1px solid var(--card-border)", verticalAlign: "top" as const };

const SECTIONS: Array<{ key: MetricsSection; label: string }> = [
  { key: "overview", label: "Resumen" },
  { key: "acquisition", label: "Adquisición" },
  { key: "engagement", label: "Engagement" },
  { key: "learning", label: "Aprendizaje" },
  { key: "content", label: "Contenido" },
  { key: "funnels", label: "Funnels" },
  { key: "audience", label: "Audiencia" },
  { key: "experiments", label: "Experimentos" },
  { key: "alerts", label: "Alertas" },
  { key: "exports", label: "Exportaciones" },
];

export default function MetricsDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [sectionCache, setSectionCache] = useState<Partial<Record<MetricsSection, DashboardData>>>({});
  const [days, setDays] = useState("30");
  const [bookSlug, setBookSlug] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [section, setSection] = useState<MetricsSection>("overview");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadMetrics(targetSection: MetricsSection = section, force = false) {
    if (!force && sectionCache[targetSection]) {
      setData(sectionCache[targetSection] ?? EMPTY_DATA);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const qs = new URLSearchParams();
      qs.set("section", targetSection);
      qs.set("days", days);
      if (bookSlug.trim()) qs.set("bookSlug", bookSlug.trim());
      if (storySlug.trim()) qs.set("storySlug", storySlug.trim());
      const res = await fetch(`/api/metrics/dashboard?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as DashboardData;
      setSectionCache((c) => ({ ...c, [targetSection]: json }));
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const message = msg.includes("403")
        ? "No tienes acceso a métricas."
        : `No se pudieron cargar las métricas: ${msg}`;
      setErrorMessage(message);
      console.error("Error loading metrics dashboard:", err);
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sectionCache[section]) {
      setData(sectionCache[section] ?? EMPTY_DATA);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      window.requestAnimationFrame(() => { void loadMetrics(section); });
    }, 0);
    return () => { window.clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    setSectionCache({});
    setData(EMPTY_DATA);
  }, [bookSlug, days, storySlug]);

  /* ── KPI definitions ── */
  const kpis = [
    { label: "DAU", value: data.kpis.dau },
    { label: "WAU", value: data.kpis.wau },
    { label: "Active Users (Range)", value: data.kpis.activeUsersInRange },
    { label: "Plays", value: data.kpis.plays },
    { label: "Completions", value: data.kpis.completions },
    { label: "Completion Rate", value: `${data.kpis.completionRate}%` },
    { label: "Unique Stories", value: data.kpis.uniqueStories },
    { label: "Unique Books", value: data.kpis.uniqueBooks },
    { label: "Avg Min / Active User", value: data.kpis.avgMinutesPerActiveUser },
    { label: "Total Listened (min)", value: data.kpis.totalListenedMinutes },
    { label: "Stories Saved", value: data.kpis.savedStories },
    { label: "Books Saved", value: data.kpis.savedBooks },
  ];

  /* ── Spinner element ── */
  const spinner = (
    <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
  );

  /* ── Empty section placeholder ── */
  function EmptySection({ title, description }: { title: string; description: string }) {
    return (
      <div style={card}>
        <h3 style={heading}>{title}</h3>
        <p style={emptyText}>{description}</p>
      </div>
    );
  }

  /* ── Section content renderer ── */
  function renderSectionContent() {
    if (section === "overview") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="studio-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {kpis.map((kpi) => (
              <div key={kpi.label} className="studio-card" style={cardCompact}>
                <p style={kpiLabel}>{kpi.label}</p>
                <p style={kpiValue}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <h3 style={heading}>Daily trend (plays vs completions)</h3>
            <MetricsOverviewChart data={data.daily} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={card}>
              <h3 style={heading}>Most listened stories (minutes)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.topStoriesByMinutes.map((story) => (
                  <div key={story.storySlug} className="studio-table-row" style={listRow}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{story.storySlug}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{story.listenedMinutes} min · {story.listeners} listeners</span>
                  </div>
                ))}
                {data.topStoriesByMinutes.length === 0 && <p style={emptyText}>No data for current filters.</p>}
              </div>
            </div>

            <div style={card}>
              <h3 style={heading}>Most saved stories</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.topSavedStories.map((story) => (
                  <div key={story.storySlug} className="studio-table-row" style={listRow}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{story.storySlug}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{story.saves} saves</span>
                  </div>
                ))}
                {data.topSavedStories.length === 0 && <p style={emptyText}>No data for current filters.</p>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (section === "engagement") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={card}>
            <h3 style={heading}>Top stories by usage</h3>
            <MetricsEngagementChart data={data.topStories} />
          </div>

          <div style={card}>
            <h3 style={heading}>Top books by usage</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.topBooks.map((book) => (
                <div key={book.bookSlug} className="studio-table-row" style={listRow}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{book.bookSlug}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>Plays {book.plays} · Completions {book.completions} · CR {book.completionRate}%</span>
                </div>
              ))}
              {data.topBooks.length === 0 && <p style={emptyText}>No data for current filters.</p>}
            </div>
          </div>

          <div style={card}>
            <h3 style={heading}>Top saved books</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.topSavedBooks.map((book) => (
                <div key={book.bookSlug} className="studio-table-row" style={listRow}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{book.bookSlug}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{book.saves} saves</span>
                </div>
              ))}
              {data.topSavedBooks.length === 0 && <p style={emptyText}>No data for current filters.</p>}
            </div>
          </div>
        </div>
      );
    }

    if (section === "acquisition") {
      return (
        <div className="studio-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div className="studio-card" style={cardCompact}>
            <p style={kpiLabel}>Plans viewed</p>
            <p style={kpiValue}>{data.checkoutFunnel.plansViewed}</p>
          </div>
          <div className="studio-card" style={cardCompact}>
            <p style={kpiLabel}>Checkout started</p>
            <p style={kpiValue}>{data.checkoutFunnel.checkoutStarted}</p>
            <p style={subLabel}>{data.checkoutFunnel.checkoutStartRate}% from plans view</p>
          </div>
          <div className="studio-card" style={cardCompact}>
            <p style={kpiLabel}>Checkout redirect</p>
            <p style={kpiValue}>{data.checkoutFunnel.checkoutRedirected}</p>
            <p style={subLabel}>{data.checkoutFunnel.checkoutRedirectRate}% from checkout start</p>
          </div>
          <div className="studio-card" style={cardCompact}>
            <p style={kpiLabel}>Checkout failed</p>
            <p style={kpiValue}>{data.checkoutFunnel.checkoutFailed}</p>
          </div>
        </div>
      );
    }

    if (section === "learning") {
      return <EmptySection title="Learning Outcomes" description="Track vocabulary retention, streak performance, and progress by language/level. You can connect favorites + review outcomes in this section." />;
    }

    if (section === "content") {
      return <EmptySection title="Content Performance" description="Compare completion rate by topic, level, language, region, and cover/title versions." />;
    }

    if (section === "funnels") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Trial funnel */}
          <div className="studio-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <div className="studio-card" style={cardCompact}>
              <p style={kpiLabel}>Trial Started</p>
              <p style={kpiValue}>{data.trialFunnel.started}</p>
            </div>
            <div className="studio-card" style={cardCompact}>
              <p style={kpiLabel}>Day-1 Active</p>
              <p style={kpiValue}>{data.trialFunnel.day1Active}</p>
              <p style={subLabel}>{data.trialFunnel.day1ActivationRate}% activation</p>
            </div>
            <div className="studio-card" style={cardCompact}>
              <p style={kpiLabel}>Converted</p>
              <p style={kpiValue}>{data.trialFunnel.converted}</p>
              <p style={subLabel}>{data.trialFunnel.conversionRate}% conversion</p>
            </div>
            <div className="studio-card" style={cardCompact}>
              <p style={kpiLabel}>Canceled</p>
              <p style={kpiValue}>{data.trialFunnel.canceled}</p>
              <p style={subLabel}>{data.trialFunnel.cancelRate}% cancel rate</p>
            </div>
          </div>

          {/* Journey funnel */}
          <div style={card}>
            <h3 style={heading}>Journey funnel</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Variants selected", value: data.journeyFunnel.variantSelected },
                { label: "Topics opened", value: data.journeyFunnel.topicOpened, sub: `${data.journeyFunnel.topicOpenRateFromVariant}% from variant select` },
                { label: "Next action clicks", value: data.journeyFunnel.nextActionClicked, sub: `${data.journeyFunnel.nextActionRateFromTopicOpen}% from topic open` },
                { label: "Review CTA clicks", value: data.journeyFunnel.reviewCtaClicked, sub: `${data.journeyFunnel.reviewRateFromTopicOpen}% from topic open` },
              ].map((item) => (
                <div key={item.label} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                  <p style={kpiLabel}>{item.label}</p>
                  <p style={{ ...kpiValue, fontSize: 24 }}>{item.value}</p>
                  {item.sub && <p style={subLabel}>{item.sub}</p>}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
              {[
                { label: "Level selections", value: data.journeyFunnel.levelSelected },
                { label: "Checkpoint recovery", value: data.journeyFunnel.checkpointRecoveryClicked },
                { label: "Recommended mode opens", value: data.journeyFunnel.recommendedModeOpened },
              ].map((item) => (
                <div key={item.label} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                  <p style={kpiLabel}>{item.label}</p>
                  <p style={{ ...kpiValue, fontSize: 22 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reminders funnel */}
          <div style={card}>
            <h3 style={heading}>Reminders funnel</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                <p style={kpiLabel}>Scheduled</p>
                <p style={{ ...kpiValue, fontSize: 24 }}>{data.reminderFunnel.scheduled}</p>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                <p style={kpiLabel}>Tapped</p>
                <p style={{ ...kpiValue, fontSize: 24 }}>{data.reminderFunnel.tapped}</p>
                <p style={subLabel}>{data.reminderFunnel.tapRateFromScheduled}% from scheduled</p>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                <p style={kpiLabel}>Destination opened</p>
                <p style={{ ...kpiValue, fontSize: 24 }}>{data.reminderFunnel.destinationOpened}</p>
                <p style={subLabel}>{data.reminderFunnel.openRateFromTap}% from tap</p>
              </div>
            </div>
            <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
              <p style={{ ...sectionLabel, marginBottom: 10 }}>Destination breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.reminderFunnel.destinationBreakdown.map((row) => (
                  <div key={row.destination} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "var(--foreground)", textTransform: "capitalize" as const }}>{row.destination}</span>
                    <span style={{ color: "var(--muted)" }}>{row.opens} opens</span>
                  </div>
                ))}
                {data.reminderFunnel.destinationBreakdown.length === 0 && <p style={emptyText}>No reminder opens for current filters.</p>}
              </div>
            </div>
          </div>

          {/* Recent reminder taps table */}
          <div style={card}>
            <h3 style={heading}>Recent reminder taps</h3>
            <p style={{ ...emptyText, marginBottom: 12 }}>Most recent notification taps, including where the push tried to send the user.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tapped at</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Destination</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReminderTaps.map((row) => (
                    <tr key={`${row.userId}-${row.createdAt}-${row.destination ?? "unknown"}`} className="studio-table-row">
                      <td style={tdStyle}>{new Date(row.createdAt).toLocaleString()}</td>
                      <td style={tdStyle}>{row.email ?? "Unknown"}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{row.userId}</td>
                      <td style={tdStyle}>{row.destination ?? "Unknown"}</td>
                      <td style={tdStyle}>{row.source ?? "Unknown"}</td>
                      <td style={tdStyle}>{row.eventType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recentReminderTaps.length === 0 && <p style={{ ...emptyText, marginTop: 8 }}>No recent reminder taps for current filters.</p>}
          </div>

          {/* Recent reminder opens table */}
          <div style={card}>
            <h3 style={heading}>Recent reminder destination opens</h3>
            <p style={{ ...emptyText, marginBottom: 12 }}>The destinations users actually reached after tapping a reminder.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Opened at</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Destination</th>
                    <th style={thStyle}>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentReminderOpens.map((row) => (
                    <tr key={`${row.userId}-${row.createdAt}-${row.destination ?? "unknown"}`} className="studio-table-row">
                      <td style={tdStyle}>{new Date(row.createdAt).toLocaleString()}</td>
                      <td style={tdStyle}>{row.email ?? "Unknown"}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{row.userId}</td>
                      <td style={tdStyle}>{row.destination ?? "Unknown"}</td>
                      <td style={tdStyle}>{row.eventType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recentReminderOpens.length === 0 && <p style={{ ...emptyText, marginTop: 8 }}>No recent reminder destination opens for current filters.</p>}
          </div>

          {/* Recent trial starts */}
          <div style={card}>
            <h3 style={heading}>Recent trial starts</h3>
            <p style={{ ...emptyText, marginBottom: 12 }}>These events fire when a Stripe checkout session is created, so they can include abandoned checkouts.</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Started at</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTrialStarts.map((row) => (
                    <tr key={`${row.userId}-${row.createdAt}-${row.eventType}`} className="studio-table-row">
                      <td style={tdStyle}>{new Date(row.createdAt).toLocaleString()}</td>
                      <td style={tdStyle}>{row.email ?? "Unknown"}</td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{row.userId}</td>
                      <td style={tdStyle}>{row.eventType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recentTrialStarts.length === 0 && <p style={{ ...emptyText, marginTop: 8 }}>No recent trial starts for current filters.</p>}
          </div>

          {/* Upgrade CTA sources */}
          <div style={card}>
            <h3 style={heading}>Upgrade CTA performance by source</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.upgradeCtaSources.map((row) => (
                <div key={row.source} className="studio-table-row" style={listRow}>
                  <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{row.source}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.clicks} clicks</span>
                </div>
              ))}
              {data.upgradeCtaSources.length === 0 && <p style={emptyText}>No CTA clicks for current filters.</p>}
            </div>
          </div>
        </div>
      );
    }

    if (section === "audience") {
      return <EmptySection title="Audience" description="Segment new vs returning users, cohorts by week, and behavior by country/device/target language." />;
    }
    if (section === "experiments") {
      return <EmptySection title="Experiments" description="Store and compare A/B test variants for covers, titles, CTAs, and paywall copy." />;
    }
    if (section === "alerts") {
      return <EmptySection title="Alerts" description="Set thresholds for completion-rate drops, traffic anomalies, and pipeline/API failures." />;
    }
    return <EmptySection title="Exports" description="Export weekly snapshots and connect BI tools (Looker Studio/Metabase) with read-only credentials." />;
  }

  return (
    <StudioShell
      title="Métricas"
      description="Sigue las historias, libros, journeys, recordatorios y funnels que más importan para tomar mejores decisiones editoriales."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Métricas" },
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Filter toolbar ── */}
        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); void loadMetrics(section, true); }} style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: "0 0 150px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Rango</label>
            <select value={days} onChange={(e) => setDays(e.target.value)} className="studio-input" style={input}>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="180">Últimos 180 días</option>
            </select>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Slug del libro</label>
            <input value={bookSlug} onChange={(e) => setBookSlug(e.target.value)} placeholder="Filtrar por bookSlug" className="studio-input" style={input} autoComplete="off" data-1p-ignore data-lpignore="true" />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Slug de la historia</label>
            <input value={storySlug} onChange={(e) => setStorySlug(e.target.value)} placeholder="Filtrar por storySlug" className="studio-input" style={input} autoComplete="off" data-1p-ignore data-lpignore="true" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="studio-btn-primary"
            style={{ ...btnPrimary, opacity: loading ? 0.7 : 1, flexShrink: 0 }}
          >
            {loading ? spinner : null}
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </form>

        {errorMessage && (
          <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: 14, fontWeight: 500 }}>
            {errorMessage}
          </div>
        )}

        {/* ── Section tabs ── */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SECTIONS.map((item) => {
            const active = item.key === section;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={active ? "" : "studio-btn-ghost"}
                style={{
                  height: 34,
                  borderRadius: 8,
                  border: active ? "none" : "1px solid var(--card-border)",
                  backgroundColor: active ? "var(--primary)" : "transparent",
                  color: active ? "#fff" : "var(--foreground)",
                  padding: "0 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ── Section content ── */}
        <div key={section} className="studio-section-fade">
          {renderSectionContent()}
        </div>
      </div>
    </StudioShell>
  );
}
