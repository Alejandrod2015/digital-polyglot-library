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
  if (failedRuns > 3 || qaPassRate < 50) {
    return { color: "#ef4444", label: "Hay problemas", status: "critical" };
  }
  if (failedRuns > 0 || qaPassRate < 70) {
    return { color: "#f59e0b", label: "Atención necesaria", status: "warning" };
  }
  return { color: "#14b8a6", label: "Todo bien", status: "good" };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const dayName = DAY_NAMES[date.getDay()];
  const day = date.getDate();
  return `${dayName} ${day}`;
}

export default function MonitorClient() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [directive, setDirective] = useState<Directive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [metricsRes, directiveRes] = await Promise.allSettled([
          fetch("/api/metrics/pipeline"),
          fetch("/api/agents/directive"),
        ]);

        // Handle metrics — show partial data if directive works
        if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
          const metricsData = await metricsRes.value.json();
          setMetrics(metricsData);
        } else {
          const detail =
            metricsRes.status === "fulfilled"
              ? `API respondió ${metricsRes.value.status}`
              : metricsRes.reason?.message ?? "red no disponible";
          setError(`No se pudieron cargar métricas del pipeline (${detail})`);
        }

        if (directiveRes.status === "fulfilled" && directiveRes.value.ok) {
          const directiveData = await directiveRes.value.json();
          setDirective(directiveData.directive);
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

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          backgroundColor: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#ef4444",
        }}
      >
        <p>{error || "No se pudieron cargar los datos"}</p>
      </div>
    );
  }

  const failedRuns = metrics.agentRuns.byStatus.failed;
  const statusInfo = getStatusColor(metrics.drafts.qaPassRate, failedRuns);

  const createdStories =
    metrics.drafts.byStatus.generated +
    metrics.drafts.byStatus.qa_pass +
    metrics.drafts.byStatus.approved +
    metrics.drafts.byStatus.published;

  const approvedStories =
    metrics.drafts.byStatus.qa_pass +
    metrics.drafts.byStatus.approved +
    metrics.drafts.byStatus.published;

  const problemStories =
    metrics.drafts.byStatus.qa_fail + metrics.drafts.byStatus.needs_review;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Estado general (top banner) */}
      <div
        style={{
          padding: 24,
          borderRadius: 14,
          backgroundColor: `${statusInfo.color}14`,
          border: `2px solid ${statusInfo.color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: statusInfo.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 28 }}>
              {statusInfo.status === "good" ? "✓" : statusInfo.status === "warning" ? "!" : "✕"}
            </span>
          </div>
          <div>
            <h2 style={{ margin: 0, color: "var(--foreground)", fontSize: 20 }}>
              {statusInfo.label}
            </h2>
            {directive && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Idiomas: {directive.languages.join(", ")} | Niveles: {directive.levels.join(", ")} |{" "}
                {directive.storiesPerSlot} historias por nivel
                {!directive.active && (
                  <span style={{ display: "block", marginTop: 4, color: "#f59e0b", fontWeight: 600 }}>
                    ⚠ Directivas inactivas
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: statusInfo.color }}>
            {Math.round(metrics.drafts.qaPassRate)}%
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
            tasa de aprobación
          </p>
        </div>
      </div>

      {/* Resumen rápido (KPI row) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {/* Historias creadas */}
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Historias creadas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: "var(--foreground)" }}>
            {createdStories}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            generadas por IA
          </p>
        </div>

        {/* Aprobadas */}
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Aprobadas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: "var(--foreground)" }}>
            {approvedStories}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            pasaron control de calidad
          </p>
        </div>

        {/* Publicadas */}
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Publicadas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: "var(--foreground)" }}>
            {metrics.drafts.byStatus.published}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            en vivo
          </p>
        </div>

        {/* Con problemas */}
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: problemStories > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--card-bg)",
            border: problemStories > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--card-border)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: problemStories > 0 ? "#ef4444" : "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Con problemas
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: problemStories > 0 ? "#ef4444" : "var(--foreground)" }}>
            {problemStories}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: problemStories > 0 ? "#ef4444" : "var(--muted)" }}>
            {problemStories > 0 ? "necesitan revisión" : "todo normal"}
          </p>
        </div>
      </div>

      {/* Ejecutar pipeline */}
      <PipelineRunner />

      {/* Últimos 7 días */}
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Actividad
        </p>
        <h3 style={{ margin: "12px 0 0", fontSize: 16, color: "var(--foreground)" }}>Últimos 7 días</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {metrics.drafts.last7Days.length > 0 ? (
            metrics.drafts.last7Days.map((day, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", minWidth: 50 }}>
                    {formatDate(day.date)}
                  </span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {day.created} creadas
                    </span>
                    <span style={{ fontSize: 13, color: "#14b8a6", fontWeight: 500 }}>
                      {day.published} publicadas
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    width: 60,
                    height: 32,
                    backgroundColor: "rgba(20, 184, 166, 0.1)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-around",
                    padding: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: `${Math.min(100, Math.max(10, day.created * 15))}%`,
                      backgroundColor: "rgba(20, 184, 166, 0.35)",
                      borderRadius: 2,
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: `${Math.min(100, Math.max(10, day.published * 15))}%`,
                      backgroundColor: "#14b8a6",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Sin datos de los últimos 7 días
            </p>
          )}
        </div>
      </div>

      {/* QA Quality Trend + Agent Performance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* QA Score Trend */}
        {metrics.qaQuality && metrics.qaQuality.scoreTrend.length > 0 && (
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tendencia QA
            </p>
            <h3 style={{ margin: "8px 0 12px", fontSize: 16, color: "var(--foreground)" }}>Score promedio (7 días)</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
              {metrics.qaQuality.scoreTrend.map((day, idx) => {
                const height = Math.max(8, (day.avgScore / 100) * 80);
                const barColor = day.avgScore >= 85 ? "#14b8a6" : day.avgScore >= 70 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <span style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{Math.round(day.avgScore)}</span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 32,
                        height,
                        backgroundColor: barColor,
                        borderRadius: 4,
                        opacity: 0.8,
                      }}
                      title={`${formatDate(day.date)}: ${day.avgScore.toFixed(1)} (${day.count} reviews)`}
                    />
                    <span style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>{formatDate(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Agent Performance */}
        {metrics.agentPerformance && (
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Rendimiento de agentes
            </p>
            <h3 style={{ margin: "8px 0 12px", fontSize: 16, color: "var(--foreground)" }}>Tiempo promedio por agente</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(["planner", "content", "qa"] as const).map((kind) => {
                const ms = metrics.agentPerformance!.avgDurationByKind[kind];
                const label = kind === "planner" ? "Planner" : kind === "content" ? "Content" : "QA";
                const seconds = ms ? (ms / 1000).toFixed(1) : "—";
                return (
                  <div key={kind} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 13, color: ms ? "var(--foreground)" : "var(--muted)", fontWeight: 600 }}>{seconds}s</span>
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>Tasa de fallos</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: metrics.agentPerformance.failureRate > 20 ? "#ef4444" : metrics.agentPerformance.failureRate > 5 ? "#f59e0b" : "#14b8a6",
                  }}>
                    {metrics.agentPerformance.failureRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent QA Reviews */}
      {metrics.qaQuality && metrics.qaQuality.recentReviews.length > 0 && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Últimas revisiones QA
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {metrics.qaQuality.recentReviews.map((review) => {
              const scoreColor = review.score >= 85 ? "#14b8a6" : review.score >= 70 ? "#f59e0b" : "#ef4444";
              const statusLabel = review.status === "pass" || review.status === "passed" ? "Aprobado" : review.status === "needs_review" ? "Revisión" : "Falló";
              return (
                <div
                  key={review.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--card-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: scoreColor,
                      minWidth: 36,
                      textAlign: "center",
                    }}>
                      {review.score}
                    </span>
                    <span style={{
                      fontSize: 13,
                      color: "var(--foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {review.storyTitle}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontWeight: 600,
                      backgroundColor: `${scoreColor}20`,
                      color: scoreColor,
                    }}>
                      {statusLabel}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      {new Date(review.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Necesita atención */}
      {(problemStories > 0 || failedRuns > 0 || (metrics.briefs.pending > 0 && metrics.briefs.pending > 10)) && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "#f59e0b",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            ⚠ Necesita atención
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {problemStories > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
                  {problemStories} {problemStories === 1 ? "historia no pasó" : "historias no pasaron"} el
                  control de calidad
                </p>
                <Link
                  href="/studio/drafts?status=qa_fail,needs_review"
                  style={{
                    fontSize: 12,
                    color: "#14b8a6",
                    textDecoration: "none",
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 6,
                    backgroundColor: "rgba(20, 184, 166, 0.1)",
                  }}
                >
                  Ver
                </Link>
              </div>
            )}

            {failedRuns > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
                  {failedRuns} {failedRuns === 1 ? "proceso falló" : "procesos fallaron"}
                </p>
                <Link
                  href="/studio/metrics"
                  style={{
                    fontSize: 12,
                    color: "#14b8a6",
                    textDecoration: "none",
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 6,
                    backgroundColor: "rgba(20, 184, 166, 0.1)",
                  }}
                >
                  Detalles
                </Link>
              </div>
            )}

            {metrics.briefs.pending > 0 && metrics.briefs.pending > 10 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
                  Hay {metrics.briefs.pending} {metrics.briefs.pending === 1 ? "historia pendiente" : "historias pendientes"} de
                  crear
                </p>
                <Link
                  href="/studio/planner"
                  style={{
                    fontSize: 12,
                    color: "#14b8a6",
                    textDecoration: "none",
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 6,
                    backgroundColor: "rgba(20, 184, 166, 0.1)",
                  }}
                >
                  Crear
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
