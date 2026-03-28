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

type BriefsResponse = {
  briefs: CurriculumBrief[];
  count: number;
};

type RunsResponse = {
  runs: ContentAgentRun[];
};

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { bg: string; border: string; text: string }
  > = {
    completed: {
      bg: "rgba(34, 197, 94, 0.08)",
      border: "rgba(34, 197, 94, 0.3)",
      text: "#22c55e",
    },
    running: {
      bg: "rgba(59, 130, 246, 0.08)",
      border: "rgba(59, 130, 246, 0.3)",
      text: "#3b82f6",
    },
    failed: {
      bg: "rgba(239, 68, 68, 0.08)",
      border: "rgba(239, 68, 68, 0.3)",
      text: "#ef4444",
    },
    pending: {
      bg: "rgba(168, 85, 247, 0.08)",
      border: "rgba(168, 85, 247, 0.3)",
      text: "#a855f7",
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 8px",
        borderRadius: 6,
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function BriefSelectCard({
  briefs,
  selectedBriefId,
  onSelect,
  loading,
  error,
}: {
  briefs: CurriculumBrief[];
  selectedBriefId: string;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div
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
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--studio-accent, #14b8a6)",
          }}
        >
          Generador de borradores
        </p>
        <h3 style={{ margin: "8px 0 6px", fontSize: 22, color: "var(--foreground)" }}>
          Generar borrador desde brief
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--muted)",
            maxWidth: 840,
            lineHeight: 1.6,
          }}
        >
          Selecciona un brief curricular en estado "draft" y genera una historia completa usando el Content Agent.
          El agente crea el texto, define slugs, calcula estadísticas y sugiere vocabulario.
        </p>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
          {error}
        </p>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
          Brief
        </span>
        <select
          value={selectedBriefId}
          onChange={(e) => onSelect(e.target.value)}
          disabled={loading || briefs.length === 0}
          style={{
            height: 42,
            borderRadius: 10,
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            padding: "0 12px",
            fontSize: 14,
            cursor: loading || briefs.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <option>Cargando briefs...</option>
          ) : briefs.length === 0 ? (
            <option>No hay briefs en estado draft</option>
          ) : (
            briefs.map((brief) => (
              <option key={brief.id} value={brief.id}>
                {brief.title} · {brief.level.toUpperCase()} · {brief.language}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );
}

function SelectedBriefDetail({
  brief,
  onRun,
  running,
}: {
  brief: CurriculumBrief | null;
  onRun: () => void;
  running: boolean;
}) {
  if (!brief) return null;

  return (
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
      <div>
        <h4 style={{ margin: "0 0 10px", fontSize: 16, color: "var(--foreground)" }}>
          {brief.title}
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Idioma
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.language}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Nivel
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.level.toUpperCase()}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Variante
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.variant}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Journey
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.journeyKey}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Topic
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.topicSlug}
            </p>
          </div>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Story Slot
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>
              {brief.storySlot}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={running}
        style={{
          height: 42,
          borderRadius: 10,
          border: "none",
          backgroundColor: "var(--primary)",
          color: "#fff",
          fontWeight: 700,
          padding: "0 18px",
          cursor: running ? "progress" : "pointer",
          opacity: running ? 0.7 : 1,
          alignSelf: "flex-start",
        }}
      >
        {running ? "Ejecutando..." : "Ejecutar Content Agent"}
      </button>
    </div>
  );
}

function RunResultCard({
  run,
}: {
  run: ContentAgentRun;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 12,
        border: "1px solid var(--card-border)",
        backgroundColor: "rgba(255,255,255,0.02)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <StatusBadge status={run.status} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
          {run.output.title}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginLeft: "auto",
          }}
        >
          {new Date(run.startedAt).toLocaleDateString("es", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span style={{ fontSize: 18, color: "var(--muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              ID del borrador
            </p>
            <p style={{ margin: 0, fontSize: 13, fontFamily: "monospace", color: "var(--studio-accent, #14b8a6)" }}>
              {run.output.draftId}
            </p>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Slug
            </p>
            <p style={{ margin: 0, fontSize: 13, fontFamily: "monospace", color: "var(--foreground)" }}>
              {run.output.slug}
            </p>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Sinopsis
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
              {run.output.synopsis}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--studio-accent, #14b8a6)" }}>
                {run.output.wordCount}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
                Palabras
              </p>
            </div>
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--studio-accent, #14b8a6)" }}>
                {run.output.vocabItemCount}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
                Vocab Items
              </p>
            </div>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Preview del texto
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--foreground)",
                lineHeight: 1.6,
                maxHeight: 120,
                overflow: "auto",
                padding: 10,
                borderRadius: 8,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              {run.output.textPreview}
            </p>
          </div>

          <div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
              Resumen de ejecución
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
              {run.output.summary}
            </p>
          </div>

          {run.toolsUsed && run.toolsUsed.length > 0 && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                Herramientas utilizadas
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {run.toolsUsed.map((tool) => (
                  <div
                    key={tool.toolName}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--card-border)",
                      backgroundColor: "var(--card-bg)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                      {tool.toolName}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
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
}

export default function ContentClient() {
  const router = useRouter();

  // Brief selection state
  const [briefs, setBriefs] = useState<CurriculumBrief[]>([]);
  const [briefsLoading, setBriefsLoading] = useState(true);
  const [briefsError, setBriefsError] = useState<string | null>(null);
  const [selectedBriefId, setSelectedBriefId] = useState("");

  // Agent run state
  const [agentRun, setAgentRun] = useState<ContentAgentRun | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);

  // Run history state
  const [runHistory, setRunHistory] = useState<ContentAgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  async function loadBriefs() {
    try {
      const res = await fetch("/api/agents/planner/briefs?status=draft");
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/content");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BriefsResponse;
      setBriefs(data.briefs);
      setSelectedBriefId((current) => current || data.briefs[0]?.id || "");
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
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/content");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RunsResponse;
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

    async function load() {
      await loadBriefs();
      await loadRunHistory();
      return () => {
        cancelled = true;
      };
    }

    void load();
  }, [router]);

  const selectedBrief = useMemo(
    () => briefs.find((b) => b.id === selectedBriefId) ?? null,
    [briefs, selectedBriefId]
  );

  async function runContentAgent() {
    if (!selectedBriefId) {
      setAgentError("Selecciona un brief antes de ejecutar el agente.");
      return;
    }

    setAgentError(null);
    setAgentRunning(true);

    try {
      const res = await fetch("/api/agents/content/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: selectedBriefId }),
      });

      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/content");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        throw new Error(body?.details ?? body?.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ContentAgentRun;
      setAgentRun(data);

      // Refresh run history after successful execution
      setHistoryLoading(true);
      await loadRunHistory();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "No se pudo ejecutar el Content Agent.");
    } finally {
      setAgentRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <BriefSelectCard
        briefs={briefs}
        selectedBriefId={selectedBriefId}
        onSelect={setSelectedBriefId}
        loading={briefsLoading}
        error={briefsError}
      />

      {selectedBrief && (
        <SelectedBriefDetail
          brief={selectedBrief}
          onRun={runContentAgent}
          running={agentRunning}
        />
      )}

      {agentError && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", margin: 0 }}>
            Error al ejecutar el agente
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
            {agentError}
          </p>
        </div>
      )}

      {agentRun && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: "var(--foreground)" }}>
              Resultado de la ejecución
            </h3>
          </div>
          <RunResultCard run={agentRun} />
        </section>
      )}

      {historyLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="studio-skeleton" style={{ height: 56 }} />
          ))}
        </div>
      ) : historyError ? (
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", margin: 0 }}>
            Error al cargar el historial
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
            {historyError}
          </p>
        </div>
      ) : runHistory.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: 40, margin: "0 0 12px" }}>📝</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            No hay ejecuciones registradas
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0" }}>
            Ejecuta el Content Agent para generar borradores.
          </p>
        </div>
      ) : (
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, color: "var(--foreground)" }}>
              Historial de generaciones
            </h3>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
              Últimas {runHistory.length} ejecuciones del Content Agent
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runHistory.map((run) => (
              <div
                key={run.runId}
                onClick={() =>
                  setExpandedRunId(
                    expandedRunId === run.runId ? null : run.runId
                  )
                }
              >
                <RunResultCard run={run} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
