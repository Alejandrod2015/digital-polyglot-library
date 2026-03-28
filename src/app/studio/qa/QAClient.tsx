"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { QAReport, QAIssue } from "@/app/api/studio/qa/route";
import type { QAAgentRun } from "@/agents/qa/types";
import type { StudioJourneyStory } from "@/lib/studioJourneyStories";

type Filter = "all" | "critical" | "warning" | "info";
type CategoryFilter = string;

type JourneyStoriesResponse = {
  stories: StudioJourneyStory[];
};

type AgentRun = {
  id: string;
  agentKind: string;
  status: "completed" | "needs_review" | "failed";
  input: Record<string, unknown>;
  output: {
    status: string;
    score: number;
    story: { title: string };
    summary: string;
    findings: Array<{
      code: string;
      severity: string;
      title: string;
      field: string;
      message: string;
      suggestion?: string;
    }>;
  };
  toolsUsed: Array<{ toolName: string; summary: string }>;
  startedAt: string;
  completedAt: string;
  createdAt: string;
};

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.3)", text: "#ef4444", dot: "#ef4444" },
  warning: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.3)", text: "#f59e0b", dot: "#f59e0b" },
  info: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.3)", text: "#3b82f6", dot: "#3b82f6" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 8px",
        borderRadius: 6,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {severity}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 10,
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        textAlign: "center",
        flex: 1,
        minWidth: 100,
      }}
    >
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", margin: "4px 0 0" }}>
        {label}
      </p>
    </div>
  );
}

function IssueCard({ issue }: { issue: QAIssue }) {
  const [expanded, setExpanded] = useState(false);
  const c = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.info;

  return (
    <div
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderLeft: `3px solid ${c.dot}`,
        borderRadius: 10,
        padding: "14px 18px",
        cursor: "pointer",
        transition: "background-color 0.15s",
      }}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      role="button"
      tabIndex={0}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SeverityBadge severity={issue.severity} />
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", padding: "2px 6px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 4 }}>
          {issue.id}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)", backgroundColor: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4 }}>
          {issue.category}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", flex: 1, minWidth: 200 }}>
          {issue.title}
        </span>
        <span style={{ fontSize: 18, color: "var(--muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)" }}>
          <p style={{ fontSize: 13, fontFamily: "monospace", color: "var(--studio-accent, #14b8a6)", margin: "0 0 10px", wordBreak: "break-all" }}>
            {issue.file}
          </p>
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 10px", lineHeight: 1.6 }}>
            {issue.description}
          </p>
          <p style={{ fontSize: 13, color: "#a78bfa", margin: "0 0 10px" }}>
            <strong style={{ color: "#7c3aed" }}>Afecta a: </strong>
            {issue.affected}
          </p>
          <div
            style={{
              fontSize: 13,
              color: "#7dd3a0",
              backgroundColor: "rgba(125, 211, 160, 0.06)",
              border: "1px solid rgba(125, 211, 160, 0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              lineHeight: 1.5,
            }}
          >
            <strong>Fix: </strong>{issue.fix}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QAClient() {
  const router = useRouter();
  const [report, setReport] = useState<QAReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const [stories, setStories] = useState<StudioJourneyStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [agentRun, setAgentRun] = useState<QAAgentRun | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);

  const [runHistory, setRunHistory] = useState<AgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  async function loadRunHistory() {
    try {
      const res = await fetch("/api/agents/runs?kind=qa&limit=20");
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/qa");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: AgentRun[] };
      setRunHistory(data.runs);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "No se pudo cargar el historial de ejecuciones.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const res = await fetch("/api/studio/qa");
        if (res.status === 401) {
          router.push("/sign-in?redirect_url=/studio/qa");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as QAReport;
        if (!cancelled) {
          setReport(data);
          setReportLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setReportError(err instanceof Error ? err.message : "No se pudo cargar la auditoría.");
          setReportLoading(false);
        }
      }
    }

    async function loadStories() {
      try {
        const res = await fetch("/api/studio/journey-stories", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/sign-in?redirect_url=/studio/qa");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as JourneyStoriesResponse;
        if (!cancelled) {
          setStories(data.stories);
          setSelectedStoryId((current) => current || data.stories[0]?.id || "");
          setStoriesLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStoriesError(err instanceof Error ? err.message : "No se pudieron cargar historias del Journey.");
          setStoriesLoading(false);
        }
      }
    }

    void loadReport();
    void loadStories();
    void loadRunHistory();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedStory = useMemo(
    () => stories.find((story) => story.id === selectedStoryId) ?? null,
    [stories, selectedStoryId]
  );

  async function runQaAgent() {
    if (!selectedStoryId) {
      setAgentError("Selecciona una historia antes de ejecutar el agent.");
      return;
    }

    setAgentError(null);
    setAgentRunning(true);

    try {
      const res = await fetch(`/api/agents/qa/journey-story/${selectedStoryId}`, {
        method: "POST",
      });

      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/qa");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as QAAgentRun;
      setAgentRun(data);
      // Refresh run history after successful execution
      setHistoryLoading(true);
      await loadRunHistory();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "No se pudo ejecutar el QA Agent.");
    } finally {
      setAgentRunning(false);
    }
  }

  const categories = Array.from(new Set(report?.issues.map((i) => i.category) ?? []));

  const filtered = (report?.issues ?? []).filter((issue) => {
    if (filter !== "all" && issue.severity !== filter) return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
    return true;
  });

  const formattedDate = report
    ? new Date(report.generatedAt).toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section
        style={{
          padding: 20,
          borderRadius: 12,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--studio-accent, #14b8a6)" }}>
            Primer agent real
          </p>
          <h3 style={{ margin: "8px 0 6px", fontSize: 22, color: "var(--foreground)" }}>
            QA Agent de historias del Journey
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: 840, lineHeight: 1.6 }}>
            Aquí el agent no es un prompt mágico. Es una ruta de servidor + tools explícitas + salida estructurada.
            Seleccionas una historia, se ejecutan checks y recibes un resultado revisable.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.4fr) minmax(220px, 1fr) auto", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Historia</span>
            <select
              value={selectedStoryId}
              onChange={(e) => setSelectedStoryId(e.target.value)}
              disabled={storiesLoading || stories.length === 0}
              style={{
                height: 42,
                borderRadius: 10,
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                padding: "0 12px",
              }}
            >
              {storiesLoading ? (
                <option>Cargando historias...</option>
              ) : stories.length === 0 ? (
                <option>No hay historias disponibles</option>
              ) : (
                stories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title || "Sin título"} · {story.cefrLevel.toUpperCase()} · {story.variant.toUpperCase()}
                  </option>
                ))
              )}
            </select>
          </label>

          <div
            style={{
              minHeight: 42,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
            }}
          >
            {selectedStory ? (
              <>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {selectedStory.journeyTopic || "Sin topic"} · slot {selectedStory.journeyOrder ?? "?"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  {selectedStory.language} · {selectedStory.variant.toUpperCase()}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Selecciona una historia</span>
            )}
          </div>

          <button
            onClick={() => void runQaAgent()}
            disabled={agentRunning || !selectedStoryId}
            style={{
              height: 42,
              borderRadius: 10,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "#fff",
              fontWeight: 700,
              padding: "0 18px",
              cursor: agentRunning ? "progress" : "pointer",
              opacity: agentRunning || !selectedStoryId ? 0.7 : 1,
            }}
          >
            {agentRunning ? "Ejecutando..." : "Ejecutar QA Agent"}
          </button>
        </div>

        {storiesError && (
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
            {storiesError}
          </p>
        )}

        {agentError && (
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
            {agentError}
          </p>
        )}

        {agentRun && (
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              border: "1px solid var(--card-border)",
              backgroundColor: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <SeverityBadge
                severity={
                  agentRun.output.status === "pass"
                    ? "info"
                    : agentRun.output.status === "needs_review"
                      ? "warning"
                      : "critical"
                }
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                Score {agentRun.output.score}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {agentRun.output.story.title || "Sin título"}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.6 }}>
              {agentRun.output.summary}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {agentRun.toolsUsed.map((tool) => (
                <div
                  key={tool.toolName}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--card-bg)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{tool.toolName}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{tool.summary}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {agentRun.output.findings.map((finding) => (
                <div
                  key={finding.code}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--card-border)",
                    backgroundColor: "var(--card-bg)",
                    borderLeft: `3px solid ${(SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info).dot}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <SeverityBadge severity={finding.severity} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{finding.title}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{finding.field}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                    {finding.message}
                  </p>
                  {finding.suggestion && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                      Sugerencia: {finding.suggestion}
                    </p>
                  )}
                </div>
              ))}
              {agentRun.output.findings.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: "#7dd3a0" }}>
                  No se detectaron hallazgos. Esta historia está muy cerca de estar lista.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          padding: 20,
          borderRadius: 12,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--studio-accent, #14b8a6)" }}>
            Historial
          </p>
          <h3 style={{ margin: "8px 0 6px", fontSize: 22, color: "var(--foreground)" }}>
            Historial de ejecuciones
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: 840, lineHeight: 1.6 }}>
            Últimas ejecuciones del QA Agent. Haz clic en una ejecución para ver detalles.
          </p>
        </div>

        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="studio-skeleton" style={{ height: 80 }} />
            ))}
          </div>
        ) : historyError ? (
          <div style={{ padding: 16, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <p style={{ fontSize: 13, color: "#ef4444", margin: 0 }}>{historyError}</p>
          </div>
        ) : runHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
              No hay ejecuciones del QA Agent aún. Ejecuta el agent desde arriba para ver el historial.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runHistory.map((run) => {
              const isExpanded = expandedRun === run.id;
              const statusColor =
                run.status === "completed"
                  ? "#22c55e"
                  : run.status === "needs_review"
                    ? "#f59e0b"
                    : "#ef4444";
              const statusLabel =
                run.status === "completed"
                  ? "Completada"
                  : run.status === "needs_review"
                    ? "Requiere revisión"
                    : "Fallida";

              const createdDate = new Date(run.createdAt).toLocaleString("es");

              return (
                <div
                  key={run.id}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--card-border)",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "background-color 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    onKeyDown={(e) => e.key === "Enter" && setExpandedRun(isExpanded ? null : run.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: statusColor,
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>
                      {statusLabel}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                      Score {run.output.score}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {run.output.story.title || "Sin título"}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
                      {createdDate}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: "var(--muted)",
                        transform: isExpanded ? "rotate(180deg)" : "none",
                        transition: "transform 0.15s",
                      }}
                    >
                      ▾
                    </span>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: "14px 16px",
                        borderTop: "1px solid var(--card-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                          Resumen
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                          {run.output.summary}
                        </p>
                      </div>

                      {run.output.findings && run.output.findings.length > 0 && (
                        <div>
                          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                            Hallazgos ({run.output.findings.length})
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {run.output.findings.map((finding) => {
                              const findingColor = SEVERITY_COLORS[finding.severity] ?? SEVERITY_COLORS.info;
                              return (
                                <div
                                  key={finding.code}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    border: `1px solid ${findingColor.border}`,
                                    backgroundColor: findingColor.bg,
                                    borderLeft: `3px solid ${findingColor.dot}`,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: findingColor.text, textTransform: "uppercase" }}>
                                      {finding.severity}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                                      {finding.title}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)" }}>
                                    {finding.message}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {run.toolsUsed && run.toolsUsed.length > 0 && (
                        <div>
                          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)" }}>
                            Tools utilizadas
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {run.toolsUsed.map((tool) => (
                              <div
                                key={tool.toolName}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  border: "1px solid var(--card-border)",
                                  backgroundColor: "rgba(255,255,255,0.02)",
                                }}
                              >
                                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                                  {tool.toolName}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                                  {tool.summary}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {reportLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="studio-skeleton" style={{ height: 80 }} />
          <div style={{ display: "flex", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="studio-skeleton" style={{ height: 80, flex: 1 }} />)}
          </div>
          {[1, 2, 3].map((i) => <div key={i} className="studio-skeleton" style={{ height: 56 }} />)}
        </div>
      ) : reportError ? (
        <div style={{ padding: 20, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", margin: 0 }}>Error al cargar el reporte</p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>{reportError}</p>
        </div>
      ) : !report || report.issues.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: 40, margin: "0 0 12px" }}>🛡️</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>No hay issues reportados</p>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0" }}>
            Ejecuta una auditoría para escanear la app.
          </p>
        </div>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, color: "var(--foreground)" }}>Auditoría general de la app</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
              Esta sección sigue mostrando el reporte global actual del producto.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Critical" value={report.summary.critical} color="#ef4444" />
            <StatCard label="Warning" value={report.summary.warning} color="#f59e0b" />
            <StatCard label="Info" value={report.summary.info} color="#3b82f6" />
            <StatCard label="Total" value={report.summary.total} color="var(--foreground)" />
          </div>

          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Última auditoría: {formattedDate}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--muted)", marginRight: 4 }}>Filtrar:</span>
            {(["all", "critical", "warning", "info"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 12,
                  fontWeight: filter === f ? 600 : 500,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: filter === f ? "var(--studio-accent, #14b8a6)" : "var(--card-border)",
                  backgroundColor: filter === f ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
                  color: filter === f ? "var(--studio-accent, #14b8a6)" : "var(--muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}

            <span style={{ width: 1, height: 20, backgroundColor: "var(--card-border)", margin: "0 4px" }} />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                fontSize: 12,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--card-bg)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
              {filtered.length} issue{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
            {filtered.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--muted)", padding: 32, fontSize: 14 }}>
                No hay issues con estos filtros.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
