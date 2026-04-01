"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CurriculumBrief = {
  id: string;
  language: string;
  variant: string;
  level: string;
  journeyKey: string;
  topicSlug: string;
  storySlot: string;
  journeyFocus: string;
  title: string;
  brief: Record<string, unknown>;
  status: string;
  createdAt: string;
};

type ContentAgentRunOutput = {
  status: string;
  draftId: string;
  title: string;
  slug: string;
  synopsis: string;
  textPreview: string;
  wordCount: number;
  vocabItemCount: number;
  summary: string;
};

type ContentAgentRun = {
  runId: string;
  agent: string;
  status: string;
  startedAt: string;
  completedAt: string;
  input: Record<string, unknown>;
  output: ContentAgentRunOutput;
  toolsUsed: Array<{ toolName: string; summary: string }>;
};

type BriefsResponse = { briefs: CurriculumBrief[]; count: number };
type RunsResponse = { runs: ContentAgentRun[] };

const statusColors: Record<string, string> = {
  completed: "#22c55e",
  running: "#3b82f6",
  failed: "#ef4444",
  pending: "#a855f7",
};

function Badge({ status }: { status: string }) {
  const c = statusColors[status] || statusColors.pending;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "1px 6px",
        borderRadius: 4,
        backgroundColor: `${c}14`,
        color: c,
        border: `1px solid ${c}4d`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

export default function ContentClient() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<CurriculumBrief[]>([]);
  const [briefsLoading, setBriefsLoading] = useState(true);
  const [briefsError, setBriefsError] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState("");
  const [agentRun, setAgentRun] = useState<ContentAgentRun | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [runHistory, setRunHistory] = useState<ContentAgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectedBrief = useMemo(
    () => briefs.find((b) => b.id === selectedBriefId) ?? null,
    [briefs, selectedBriefId],
  );

  async function loadBriefs() {
    try {
      const res = await fetch("/api/agents/planner/briefs?status=draft");
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/content"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BriefsResponse;
      setBriefs(data.briefs);
      setSelectedBriefId((c) => c || data.briefs[0]?.id || "");
      setBriefsError(null);
    } catch (err) {
      setBriefsError(err instanceof Error ? err.message : "No se pudieron cargar los briefs.");
    } finally {
      setBriefsLoading(false);
    }
  }

  async function loadRunHistory() {
    try {
      const res = await fetch("/api/agents/runs?kind=content&limit=20");
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/content"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RunsResponse;
      setRunHistory(data.runs);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void (async () => { await loadBriefs(); await loadRunHistory(); })();
  }, [router]);

  async function runContentAgent() {
    if (!selectedBriefId) { setAgentError("Selecciona un brief."); return; }
    setAgentError(null);
    setAgentRunning(true);
    try {
      const res = await fetch("/api/agents/content/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: selectedBriefId }),
      });
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/content"); return; }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(body?.details ?? body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ContentAgentRun;
      setAgentRun(data);
      setHistoryLoading(true);
      await loadRunHistory();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "No se pudo ejecutar el Content Agent.");
    } finally {
      setAgentRunning(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  /* ---- Inline run detail (used for both latest result and history expansion) ---- */
  function RunDetail({ run }: { run: ContentAgentRun }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--foreground)" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span><Lbl>Draft ID</Lbl>{" "}<code style={{ color: "var(--studio-accent, #14b8a6)" }}>{run.output.draftId}</code></span>
          <span><Lbl>Slug</Lbl>{" "}<code>{run.output.slug}</code></span>
          <span><Lbl>Palabras</Lbl>{" "}<strong style={{ color: "var(--studio-accent, #14b8a6)" }}>{run.output.wordCount}</strong></span>
          <span><Lbl>Vocab</Lbl>{" "}<strong style={{ color: "var(--studio-accent, #14b8a6)" }}>{run.output.vocabItemCount}</strong></span>
        </div>
        <div style={{ lineHeight: 1.5 }}>
          <Lbl>Sinopsis</Lbl>{" "}{run.output.synopsis}
        </div>
        <div
          style={{
            maxHeight: 80,
            overflow: "auto",
            padding: "4px 6px",
            borderRadius: 4,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            lineHeight: 1.5,
            fontSize: 11,
          }}
        >
          {run.output.textPreview}
        </div>
        <div style={{ lineHeight: 1.5 }}>
          <Lbl>Resumen</Lbl>{" "}{run.output.summary}
        </div>
        {run.toolsUsed?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Lbl>Tools</Lbl>{" "}
            {run.toolsUsed.map((t) => (
              <span
                key={t.toolName}
                title={t.summary}
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 3,
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                }}
              >
                {t.toolName}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ===== Brief selector + run button ===== */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--studio-accent, #14b8a6)" }}>
            Generador de borradores
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            Selecciona un brief y genera una historia con el Content Agent.
          </span>
        </div>

        {briefsError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{briefsError}</p>}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedBriefId}
            onChange={(e) => setSelectedBriefId(e.target.value)}
            disabled={briefsLoading || briefs.length === 0}
            style={{
              flex: 1,
              minWidth: 200,
              height: 32,
              borderRadius: 6,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              padding: "0 8px",
              fontSize: 12,
              cursor: briefsLoading || briefs.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {briefsLoading ? (
              <option>Cargando...</option>
            ) : briefs.length === 0 ? (
              <option>Sin briefs draft</option>
            ) : (
              briefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} / {b.level.toUpperCase()} / {b.language}
                </option>
              ))
            )}
          </select>

          <button
            onClick={runContentAgent}
            disabled={agentRunning || !selectedBriefId}
            style={{
              height: 32,
              borderRadius: 6,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "#fff",
              fontWeight: 700,
              padding: "0 14px",
              fontSize: 12,
              cursor: agentRunning ? "progress" : "pointer",
              opacity: agentRunning || !selectedBriefId ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {agentRunning ? "Generando..." : "Generar historia"}
          </button>
        </div>

        {/* Brief detail row */}
        {selectedBrief && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--foreground)" }}>
            {[
              ["Idioma", selectedBrief.language],
              ["Nivel", selectedBrief.level.toUpperCase()],
              ["Variante", selectedBrief.variant],
              ["Journey", selectedBrief.journeyKey],
              ["Topic", selectedBrief.topicSlug],
              ["Slot", selectedBrief.storySlot],
            ].map(([label, val]) => (
              <span key={label}>
                <Lbl>{label}</Lbl>{" "}{val}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ===== Agent error ===== */}
      {agentError && (
        <div style={{ padding: "6px 10px", borderRadius: 6, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>Error: </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{agentError}</span>
        </div>
      )}

      {/* ===== Latest run result (inline) ===== */}
      {agentRun && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--card-border)",
            backgroundColor: "rgba(255,255,255,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Badge status={agentRun.status} />
            <strong style={{ color: "var(--foreground)" }}>{agentRun.output.title}</strong>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>Resultado</span>
          </div>
          <RunDetail run={agentRun} />
        </div>
      )}

      {/* ===== Run history (collapsible) ===== */}
      {historyLoading ? (
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="studio-skeleton" style={{ height: 24, flex: 1 }} />
          ))}
        </div>
      ) : historyError ? (
        <div style={{ padding: "6px 10px", borderRadius: 6, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>Error historial: </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{historyError}</span>
        </div>
      ) : runHistory.length === 0 ? (
        <p style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--muted)", margin: 0 }}>
          Sin ejecuciones registradas. Ejecuta el Content Agent para generar borradores.
        </p>
      ) : (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
            overflow: "hidden",
          }}
        >
          {/* Collapsible header */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--foreground)",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14, transform: historyOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              &#9662;
            </span>
            Historial ({runHistory.length})
          </button>

          {historyOpen && (
            <div style={{ borderTop: "1px solid var(--card-border)" }}>
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 100px 60px 60px 40px",
                  gap: 4,
                  padding: "4px 12px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--card-border)",
                }}
              >
                <span>Estado</span>
                <span>Titulo</span>
                <span>Fecha</span>
                <span>Words</span>
                <span>Vocab</span>
                <span />
              </div>

              {runHistory.map((run) => (
                <div key={run.runId}>
                  <div
                    onClick={() => setExpandedRunId(expandedRunId === run.runId ? null : run.runId)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr 100px 60px 60px 40px",
                      gap: 4,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                      borderBottom: "1px solid var(--card-border)",
                      alignItems: "center",
                    }}
                  >
                    <Badge status={run.status} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--foreground)", fontWeight: 600 }}>
                      {run.output.title}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(run.startedAt)}</span>
                    <span style={{ fontSize: 11, color: "var(--foreground)" }}>{run.output.wordCount}</span>
                    <span style={{ fontSize: 11, color: "var(--foreground)" }}>{run.output.vocabItemCount}</span>
                    <span style={{ fontSize: 14, color: "var(--muted)", transform: expandedRunId === run.runId ? "rotate(180deg)" : "none", transition: "transform 0.15s", textAlign: "center" }}>
                      &#9662;
                    </span>
                  </div>
                  {expandedRunId === run.runId && (
                    <div style={{ padding: "6px 12px 10px", borderBottom: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                      <RunDetail run={run} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
