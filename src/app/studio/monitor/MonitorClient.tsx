"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PipelineRunner from "@/components/studio/PipelineRunner";

interface MetricsData {
  agentRuns: {
    total: number;
    byKind: { planner: number; content: number; qa: number };
    byStatus: { completed: number; failed: number; running: number };
    last7Days: Array<{ date: string; completed: number; failed: number }>;
  };
  drafts: {
    total: number;
    byStatus: {
      draft: number;
      generated: number;
      qa_pass: number;
      qa_fail: number;
      needs_review: number;
      approved: number;
      published: number;
    };
    avgQaScore: number | null;
    qaPassRate: number;
    last7Days: Array<{ date: string; created: number; published: number }>;
  };
  briefs: { total: number; pending: number; completed: number };
  pipeline: { avgTimeToPublish: number | null; contentPerDay: number };
  qaQuality?: {
    scoreTrend: Array<{ date: string; avgScore: number; count: number }>;
    recentReviews: Array<{
      id: string;
      storyTitle: string;
      score: number;
      status: string;
      createdAt: string;
    }>;
    passRateTrend: Array<{ date: string; passRate: number; total: number }>;
  };
  agentPerformance?: {
    avgDurationByKind: Record<string, number | null>;
    failureRate: number;
  };
}

interface Directive {
  languages: string[];
  levels: string[];
  topics: string[];
  storiesPerSlot: number;
  note: string;
  active: boolean;
  updatedBy: string;
  updatedAt: string;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getStatusColor(qaPassRate: number, failedRuns: number): {
  color: string;
  label: string;
  status: "good" | "warning" | "critical";
} {
  if (failedRuns > 3 || qaPassRate < 50)
    return { color: "#ef4444", label: "Hay problemas", status: "critical" };
  if (failedRuns > 0 || qaPassRate < 70)
    return { color: "#f59e0b", label: "Atención necesaria", status: "warning" };
  return { color: "#14b8a6", label: "Todo bien", status: "good" };
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

const accent = "var(--studio-accent, #14b8a6)";
const lbl: React.CSSProperties = { margin: 0, fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.05em" };
const card: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" };
const linkBtn: React.CSSProperties = { fontSize: 11, color: "#14b8a6", textDecoration: "none", fontWeight: 600, padding: "3px 8px", borderRadius: 5, backgroundColor: "rgba(20,184,166,0.1)" };

export default function MonitorClient() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [directive, setDirective] = useState<Directive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [metricsRes, directiveRes] = await Promise.allSettled([
          fetch("/api/metrics/pipeline"),
          fetch("/api/agents/directive"),
        ]);
        if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
          setMetrics(await metricsRes.value.json());
        } else {
          const detail =
            metricsRes.status === "fulfilled"
              ? `API respondió ${metricsRes.value.status}`
              : metricsRes.reason?.message ?? "red no disponible";
          setError(`No se pudieron cargar métricas del pipeline (${detail})`);
        }
        if (directiveRes.status === "fulfilled" && directiveRes.value.ok) {
          const d = await directiveRes.value.json();
          setDirective(d.directive);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando...</div>;

  if (error || !metrics) {
    return (
      <div style={{ padding: 12, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
        {error || "No se pudieron cargar los datos"}
      </div>
    );
  }

  const failedRuns = metrics.agentRuns.byStatus.failed;
  const statusInfo = getStatusColor(metrics.drafts.qaPassRate, failedRuns);
  const createdStories = metrics.drafts.byStatus.generated + metrics.drafts.byStatus.qa_pass + metrics.drafts.byStatus.approved + metrics.drafts.byStatus.published;
  const approvedStories = metrics.drafts.byStatus.qa_pass + metrics.drafts.byStatus.approved + metrics.drafts.byStatus.published;
  const problemStories = metrics.drafts.byStatus.qa_fail + metrics.drafts.byStatus.needs_review;
  const icon = statusInfo.status === "good" ? "✓" : statusInfo.status === "warning" ? "!" : "✕";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Status banner - single compact line */}
      <div style={{
        padding: "8px 14px", borderRadius: 8,
        backgroundColor: `${statusInfo.color}14`, border: `1.5px solid ${statusInfo.color}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: statusInfo.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{statusInfo.label}</span>
          {directive && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {directive.languages.join(", ")} / {directive.levels.join(", ")} / {directive.storiesPerSlot}/nivel
              {!directive.active && <span style={{ color: "#f59e0b", fontWeight: 600, marginLeft: 6 }}>Inactivas</span>}
            </span>
          )}
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: statusInfo.color, flexShrink: 0 }}>
          {Math.round(metrics.drafts.qaPassRate)}%
        </span>
      </div>

      {/* KPI row - single compact row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {([
          { label: "Creadas", value: createdStories, sub: "generadas", problem: false },
          { label: "Aprobadas", value: approvedStories, sub: "QA pass", problem: false },
          { label: "Publicadas", value: metrics.drafts.byStatus.published, sub: "en vivo", problem: false },
          { label: "Problemas", value: problemStories, sub: problemStories > 0 ? "revisar" : "ok", problem: problemStories > 0 },
        ] as const).map((kpi) => (
          <div key={kpi.label} style={{
            ...card,
            ...(kpi.problem ? { backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" } : {}),
          }}>
            <p style={{ ...lbl, color: kpi.problem ? "#ef4444" : accent }}>{kpi.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: kpi.problem ? "#ef4444" : "var(--foreground)", lineHeight: 1.1 }}>{kpi.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: kpi.problem ? "#ef4444" : "var(--muted)" }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pipeline runner */}
      <PipelineRunner />

      {/* Activity - collapsible */}
      <div style={card}>
        <button
          onClick={() => setActivityOpen(!activityOpen)}
          style={{
            all: "unset", cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <span style={{ ...lbl }}>Actividad - Últimos 7 días</span>
          <span style={{ fontSize: 11, color: "var(--muted)", transform: activityOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
        </button>
        {activityOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {metrics.drafts.last7Days.length > 0 ? metrics.drafts.last7Days.map((day, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 5, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--card-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", minWidth: 42 }}>{formatDate(day.date)}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{day.created} cre</span>
                  <span style={{ fontSize: 11, color: "#14b8a6", fontWeight: 500 }}>{day.published} pub</span>
                </div>
                <div style={{ width: 40, height: 20, backgroundColor: "rgba(20,184,166,0.1)", borderRadius: 4, display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: 2 }}>
                  <div style={{ width: 6, height: `${Math.min(100, Math.max(10, day.created * 15))}%`, backgroundColor: "rgba(20,184,166,0.35)", borderRadius: 1 }} />
                  <div style={{ width: 6, height: `${Math.min(100, Math.max(10, day.published * 15))}%`, backgroundColor: "#14b8a6", borderRadius: 1 }} />
                </div>
              </div>
            )) : <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>Sin datos</p>}
          </div>
        )}
      </div>

      {/* QA Trend + Agent Performance - compact side by side */}
      {(metrics.qaQuality?.scoreTrend?.length || metrics.agentPerformance) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
          {metrics.qaQuality && metrics.qaQuality.scoreTrend.length > 0 && (
            <div style={card}>
              <p style={lbl}>Tendencia QA</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 50, marginTop: 6 }}>
                {metrics.qaQuality.scoreTrend.map((day, i) => {
                  const h = Math.max(6, (day.avgScore / 100) * 50);
                  const c = day.avgScore >= 85 ? "#14b8a6" : day.avgScore >= 70 ? "#f59e0b" : "#ef4444";
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <span style={{ fontSize: 8, color: "var(--muted)", marginBottom: 2 }}>{Math.round(day.avgScore)}</span>
                      <div style={{ width: "100%", maxWidth: 20, height: h, backgroundColor: c, borderRadius: 3, opacity: 0.8 }} title={`${formatDate(day.date)}: ${day.avgScore.toFixed(1)} (${day.count})`} />
                      <span style={{ fontSize: 7, color: "var(--muted)", marginTop: 2 }}>{formatDate(day.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {metrics.agentPerformance && (
            <div style={card}>
              <p style={lbl}>Agentes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {(["planner", "content", "qa"] as const).map((kind) => {
                  const ms = metrics.agentPerformance!.avgDurationByKind[kind];
                  const l = kind === "planner" ? "Plan" : kind === "content" ? "Content" : "QA";
                  return (
                    <div key={kind} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "var(--foreground)" }}>{l}</span>
                      <span style={{ fontWeight: 600, color: ms ? "var(--foreground)" : "var(--muted)" }}>{ms ? `${(ms / 1000).toFixed(1)}s` : "—"}</span>
                    </div>
                  );
                })}
                <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: 4, marginTop: 2, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--foreground)" }}>Fallos</span>
                  <span style={{ fontWeight: 600, color: metrics.agentPerformance.failureRate > 20 ? "#ef4444" : metrics.agentPerformance.failureRate > 5 ? "#f59e0b" : "#14b8a6" }}>
                    {metrics.agentPerformance.failureRate}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent QA Reviews - compact */}
      {metrics.qaQuality && metrics.qaQuality.recentReviews.length > 0 && (
        <div style={card}>
          <p style={lbl}>Últimas revisiones QA</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
            {metrics.qaQuality.recentReviews.map((r) => {
              const sc = r.score >= 85 ? "#14b8a6" : r.score >= 70 ? "#f59e0b" : "#ef4444";
              const sl = r.status === "pass" || r.status === "passed" ? "OK" : r.status === "needs_review" ? "Rev" : "Fail";
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: 5, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--card-border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sc, minWidth: 26, textAlign: "center" }}>{r.score}</span>
                    <span style={{ fontSize: 11, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.storyTitle}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, backgroundColor: `${sc}20`, color: sc }}>{sl}</span>
                    <span style={{ fontSize: 9, color: "var(--muted)" }}>{new Date(r.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attention needed - compact */}
      {(problemStories > 0 || failedRuns > 0 || (metrics.briefs.pending > 10)) && (
        <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <p style={{ ...lbl, color: "#f59e0b", marginBottom: 6 }}>Necesita atención</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {problemStories > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--foreground)" }}>{problemStories} {problemStories === 1 ? "historia" : "historias"} sin pasar QA</span>
                <Link href="/studio/drafts?status=qa_fail,needs_review" style={linkBtn}>Ver</Link>
              </div>
            )}
            {failedRuns > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--foreground)" }}>{failedRuns} {failedRuns === 1 ? "proceso falló" : "procesos fallaron"}</span>
                <Link href="/studio/metrics" style={linkBtn}>Detalles</Link>
              </div>
            )}
            {metrics.briefs.pending > 10 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--foreground)" }}>{metrics.briefs.pending} pendientes de crear</span>
                <Link href="/studio/planner" style={linkBtn}>Crear</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
