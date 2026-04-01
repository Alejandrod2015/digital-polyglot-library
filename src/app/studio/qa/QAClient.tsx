"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { QAReport, QAIssue } from "@/app/api/studio/qa/route";
import type { QAAgentRun } from "@/agents/qa/types";
import type { StudioJourneyStory } from "@/lib/studioJourneyStories";

type Filter = "all" | "critical" | "warning" | "info";
type CategoryFilter = string;

type JourneyStoriesResponse = { stories: StudioJourneyStory[] };

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

const SEV: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", text: "#ef4444", dot: "#ef4444" },
  warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", dot: "#f59e0b" },
  info: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", text: "#3b82f6", dot: "#3b82f6" },
};

function Sev({ s }: { s: string }) {
  const c = SEV[s] ?? SEV.info;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", padding: "1px 6px", borderRadius: 4, backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>
      {s}
    </span>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: active ? 600 : 500, padding: "2px 10px", borderRadius: 4,
        border: `1px solid ${active ? "var(--studio-accent, #14b8a6)" : "var(--card-border)"}`,
        backgroundColor: active ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
        color: active ? "var(--studio-accent, #14b8a6)" : "var(--muted)", cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function FindingRow({ finding }: { finding: { code: string; severity: string; title: string; field: string; message: string; suggestion?: string } }) {
  const [open, setOpen] = useState(false);
  const c = SEV[finding.severity] ?? SEV.info;
  return (
    <div
      style={{ padding: "4px 8px", borderLeft: `2px solid ${c.dot}`, cursor: "pointer", fontSize: 12, backgroundColor: open ? "rgba(255,255,255,0.02)" : "transparent" }}
      onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)} role="button" tabIndex={0}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sev s={finding.severity} />
        <span style={{ fontWeight: 600, color: "var(--foreground)", flex: 1 }}>{finding.title}</span>
        <span style={{ color: "var(--muted)", fontSize: 11 }}>{finding.field}</span>
        <span style={{ color: "var(--muted)", fontSize: 12, transform: open ? "rotate(180deg)" : "none" }}>&#9662;</span>
      </div>
      {open && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--card-border)", fontSize: 12, lineHeight: 1.4 }}>
          <p style={{ margin: 0, color: "var(--foreground)" }}>{finding.message}</p>
          {finding.suggestion && <p style={{ margin: "2px 0 0", color: "var(--muted)" }}>Sugerencia: {finding.suggestion}</p>}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: QAIssue }) {
  const [open, setOpen] = useState(false);
  const c = SEV[issue.severity] ?? SEV.info;
  return (
    <div
      style={{ padding: "5px 8px", borderLeft: `2px solid ${c.dot}`, cursor: "pointer", fontSize: 12, backgroundColor: open ? "rgba(255,255,255,0.02)" : "transparent" }}
      onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)} role="button" tabIndex={0}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Sev s={issue.severity} />
        <span style={{ fontFamily: "monospace", color: "var(--muted)", fontSize: 10, padding: "0 4px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 3 }}>{issue.id}</span>
        <span style={{ color: "var(--muted)", fontSize: 10, backgroundColor: "rgba(255,255,255,0.04)", padding: "0 4px", borderRadius: 3 }}>{issue.category}</span>
        <span style={{ fontWeight: 600, color: "var(--foreground)", flex: 1, minWidth: 160 }}>{issue.title}</span>
        <span style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "none" }}>&#9662;</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--card-border)", lineHeight: 1.4, display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ margin: 0, fontFamily: "monospace", color: "var(--studio-accent, #14b8a6)", fontSize: 11, wordBreak: "break-all" }}>{issue.file}</p>
          <p style={{ margin: 0, color: "var(--foreground)" }}>{issue.description}</p>
          <p style={{ margin: 0, color: "#a78bfa", fontSize: 11 }}><strong style={{ color: "#7c3aed" }}>Afecta a: </strong>{issue.affected}</p>
          <div style={{ color: "#7dd3a0", backgroundColor: "rgba(125,211,160,0.06)", border: "1px solid rgba(125,211,160,0.15)", borderRadius: 4, padding: "4px 8px", fontSize: 11 }}>
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
  const [historyOpen, setHistoryOpen] = useState(false);

  async function loadRunHistory() {
    try {
      const res = await fetch("/api/agents/runs?kind=qa&limit=20");
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/qa"); return; }
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
        if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/qa"); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as QAReport;
        if (!cancelled) { setReport(data); setReportLoading(false); }
      } catch (err) {
        if (!cancelled) { setReportError(err instanceof Error ? err.message : "No se pudo cargar la auditoria."); setReportLoading(false); }
      }
    }
    async function loadStories() {
      try {
        const res = await fetch("/api/studio/journey-stories", { cache: "no-store" });
        if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/qa"); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as JourneyStoriesResponse;
        if (!cancelled) { setStories(data.stories); setSelectedStoryId((c) => c || data.stories[0]?.id || ""); setStoriesLoading(false); }
      } catch (err) {
        if (!cancelled) { setStoriesError(err instanceof Error ? err.message : "No se pudieron cargar historias del Journey."); setStoriesLoading(false); }
      }
    }
    void loadReport();
    void loadStories();
    void loadRunHistory();
    return () => { cancelled = true; };
  }, [router]);

  const selectedStory = useMemo(() => stories.find((s) => s.id === selectedStoryId) ?? null, [stories, selectedStoryId]);

  async function runQaAgent() {
    if (!selectedStoryId) { setAgentError("Selecciona una historia antes de ejecutar el agent."); return; }
    setAgentError(null);
    setAgentRunning(true);
    try {
      const res = await fetch(`/api/agents/qa/journey-story/${selectedStoryId}`, { method: "POST" });
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/qa"); return; }
      if (!res.ok) { const body = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(body?.error ?? `HTTP ${res.status}`); }
      const data = (await res.json()) as QAAgentRun;
      setAgentRun(data);
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
  const formattedDate = report ? new Date(report.generatedAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* QA Agent Section */}
      <section style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--studio-accent, #14b8a6)" }}>Primer agent real</p>
          <h3 style={{ margin: "4px 0 2px", fontSize: 16, color: "var(--foreground)" }}>QA Agent de historias del Journey</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
            Selecciona una historia, se ejecutan checks y recibes un resultado revisable.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.4fr) minmax(180px, 1fr) auto", gap: 8, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)" }}>Historia</span>
            <select
              value={selectedStoryId} onChange={(e) => setSelectedStoryId(e.target.value)}
              disabled={storiesLoading || stories.length === 0}
              style={{ height: 32, borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 8px", fontSize: 12 }}
            >
              {storiesLoading ? <option>Cargando...</option> : stories.length === 0 ? <option>No hay historias</option> : stories.map((s) => (
                <option key={s.id} value={s.id}>{s.title || "Sin titulo"} - {s.cefrLevel.toUpperCase()} - {s.variant.toUpperCase()}</option>
              ))}
            </select>
          </label>
          <div style={{ minHeight: 32, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 8px", borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", fontSize: 11 }}>
            {selectedStory ? (
              <>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>{selectedStory.journeyTopic || "Sin topic"} - slot {selectedStory.journeyOrder ?? "?"}</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{selectedStory.language} - {selectedStory.variant.toUpperCase()}</span>
              </>
            ) : <span style={{ color: "var(--muted)" }}>Selecciona una historia</span>}
          </div>
          <button
            onClick={() => void runQaAgent()} disabled={agentRunning || !selectedStoryId}
            style={{ height: 32, borderRadius: 6, border: "none", backgroundColor: "var(--primary)", color: "#fff", fontWeight: 700, padding: "0 14px", cursor: agentRunning ? "progress" : "pointer", opacity: agentRunning || !selectedStoryId ? 0.7 : 1, fontSize: 12 }}
          >
            {agentRunning ? "Ejecutando..." : "Ejecutar QA Agent"}
          </button>
        </div>

        {storiesError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{storiesError}</p>}
        {agentError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{agentError}</p>}

        {agentRun && (
          <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Sev s={agentRun.output.status === "pass" ? "info" : agentRun.output.status === "needs_review" ? "warning" : "critical"} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>Score {agentRun.output.score}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{agentRun.output.story.title || "Sin titulo"}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.4 }}>{agentRun.output.summary}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {agentRun.toolsUsed.map((t) => (
                <span key={t.toolName} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--muted)" }} title={t.summary}>{t.toolName}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {agentRun.output.findings.map((f) => <FindingRow key={f.code} finding={f} />)}
              {agentRun.output.findings.length === 0 && <p style={{ margin: 0, fontSize: 11, color: "#7dd3a0" }}>Sin hallazgos. Historia lista.</p>}
            </div>
          </div>
        )}
      </section>

      {/* Run History - Collapsible */}
      <section style={{ borderRadius: 8, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", overflow: "hidden" }}>
        <div
          style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          onClick={() => setHistoryOpen(!historyOpen)} onKeyDown={(e) => e.key === "Enter" && setHistoryOpen(!historyOpen)} role="button" tabIndex={0}
        >
          <span style={{ fontSize: 12, transform: historyOpen ? "rotate(180deg)" : "none", color: "var(--muted)" }}>&#9662;</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Historial de ejecuciones</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>({runHistory.length})</span>
        </div>

        {historyOpen && (
          <div style={{ borderTop: "1px solid var(--card-border)", padding: "6px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {historyLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{[1, 2, 3].map((i) => <div key={i} className="studio-skeleton" style={{ height: 28 }} />)}</div>
            ) : historyError ? (
              <p style={{ fontSize: 11, color: "#ef4444", margin: 0, padding: 4 }}>{historyError}</p>
            ) : runHistory.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, padding: "8px 0", textAlign: "center" }}>Sin ejecuciones aun.</p>
            ) : (
              runHistory.map((run) => {
                const isExp = expandedRun === run.id;
                const sc = run.status === "completed" ? "#22c55e" : run.status === "needs_review" ? "#f59e0b" : "#ef4444";
                const sl = run.status === "completed" ? "OK" : run.status === "needs_review" ? "Revisar" : "Fallida";
                return (
                  <div key={run.id} style={{ borderRadius: 4, border: isExp ? "1px solid var(--card-border)" : "none", backgroundColor: isExp ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <div
                      style={{ padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                      onClick={() => setExpandedRun(isExp ? null : run.id)} onKeyDown={(e) => e.key === "Enter" && setExpandedRun(isExp ? null : run.id)} role="button" tabIndex={0}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: sc, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: sc, fontSize: 11, minWidth: 44 }}>{sl}</span>
                      <span style={{ fontWeight: 600, color: "var(--foreground)" }}>Score {run.output.score}</span>
                      <span style={{ color: "var(--muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.output.story.title || "Sin titulo"}</span>
                      <span style={{ color: "var(--muted)", fontSize: 10, flexShrink: 0 }}>{new Date(run.createdAt).toLocaleString("es")}</span>
                      <span style={{ color: "var(--muted)", fontSize: 11, transform: isExp ? "rotate(180deg)" : "none" }}>&#9662;</span>
                    </div>
                    {isExp && (
                      <div style={{ padding: "6px 8px", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Resumen</p>
                          <p style={{ margin: "2px 0 0", color: "var(--foreground)", lineHeight: 1.4 }}>{run.output.summary}</p>
                        </div>
                        {run.output.findings?.length > 0 && (
                          <div>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Hallazgos ({run.output.findings.length})</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                              {run.output.findings.map((f) => {
                                const fc = SEV[f.severity] ?? SEV.info;
                                return (
                                  <div key={f.code} style={{ padding: "3px 6px", borderLeft: `2px solid ${fc.dot}`, fontSize: 11 }}>
                                    <span style={{ fontWeight: 600, color: fc.text, textTransform: "uppercase", marginRight: 6, fontSize: 10 }}>{f.severity}</span>
                                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{f.title}</span>
                                    <span style={{ color: "var(--muted)", marginLeft: 6 }}>{f.message}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {run.toolsUsed?.length > 0 && (
                          <div>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--muted)" }}>Tools</p>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                              {run.toolsUsed.map((t) => (
                                <span key={t.toolName} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, border: "1px solid var(--card-border)", color: "var(--muted)" }} title={t.summary}>{t.toolName}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Static Report Section */}
      {reportLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="studio-skeleton" style={{ height: 40 }} />
          <div style={{ display: "flex", gap: 8 }}>{[1, 2, 3, 4].map((i) => <div key={i} className="studio-skeleton" style={{ height: 48, flex: 1 }} />)}</div>
          {[1, 2, 3].map((i) => <div key={i} className="studio-skeleton" style={{ height: 28 }} />)}
        </div>
      ) : reportError ? (
        <div style={{ padding: 10, borderRadius: 6, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", margin: 0 }}>Error al cargar el reporte</p>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>{reportError}</p>
        </div>
      ) : !report || report.issues.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 12px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>No hay issues reportados</p>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>Ejecuta una auditoria para escanear la app.</p>
        </div>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "var(--foreground)" }}>Auditoria general</h3>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{formattedDate}</span>
          </div>

          {/* Stat pills row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([
              ["Critical", report.summary.critical, "#ef4444"],
              ["Warning", report.summary.warning, "#f59e0b"],
              ["Info", report.summary.info, "#3b82f6"],
              ["Total", report.summary.total, "var(--foreground)"],
            ] as [string, number, string][]).map(([label, val, col]) => (
              <div key={label} style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", textAlign: "center", flex: 1, minWidth: 70 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</span>
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginLeft: 6 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Filters row */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {(["all", "critical", "warning", "info"] as Filter[]).map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Pill>
            ))}
            <span style={{ width: 1, height: 14, backgroundColor: "var(--card-border)", margin: "0 2px" }} />
            <select
              value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--foreground)", cursor: "pointer" }}
            >
              <option value="all">Todas</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Issues list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
            {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--muted)", padding: 16, fontSize: 12 }}>No hay issues con estos filtros.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
