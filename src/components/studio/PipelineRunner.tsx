"use client";

import { useState, useCallback, useEffect } from "react";

// ── Types ──

type PipelineStep = {
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  detail?: string;
  data?: Record<string, unknown>;
};

type TopicGroup = {
  level: string;
  topicSlug: string;
  total: number;
  draft: number;
  generated: number;
  qa_pass: number;
  qa_fail: number;
  needs_review: number;
  approved: number;
  published: number;
};

// ── Helpers ──

const LEVEL_COLORS: Record<string, string> = {
  a1: "#22c55e",
  a2: "#84cc16",
  b1: "#eab308",
  b2: "#f97316",
  c1: "#ef4444",
  c2: "#a855f7",
};

const STEP_LABELS: Record<string, string> = {
  directive: "Directriz",
  bootstrap: "Estructura",
  planner: "Planner",
  content: "Content Agent",
  qa: "QA Agent",
  retry: "Auto-retry",
  promote: "Promoción",
  publish: "Publicación",
  covers: "Covers",
  "budget-exhausted": "Presupuesto agotado",
  done: "Completo",
  error: "Error",
};

const STEP_ICONS: Record<string, string> = {
  running: "⏳",
  completed: "✅",
  failed: "❌",
  skipped: "⏭️",
};

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: "#fff",
        backgroundColor: LEVEL_COLORS[level.toLowerCase()] ?? "#6b7280",
        textTransform: "uppercase",
      }}
    >
      {level}
    </span>
  );
}

function ProgressDots({ group }: { group: TopicGroup }) {
  const dots: Array<{ color: string; label: string }> = [];
  for (let i = 0; i < group.total; i++) {
    if (i < group.published) dots.push({ color: "#22c55e", label: "published" });
    else if (i < group.published + group.approved) dots.push({ color: "#14b8a6", label: "approved" });
    else if (i < group.published + group.approved + group.qa_pass) dots.push({ color: "#3b82f6", label: "qa_pass" });
    else if (i < group.published + group.approved + group.qa_pass + group.needs_review) dots.push({ color: "#f59e0b", label: "needs_review" });
    else if (i < group.published + group.approved + group.qa_pass + group.needs_review + group.qa_fail) dots.push({ color: "#ef4444", label: "qa_fail" });
    else if (i < group.published + group.approved + group.qa_pass + group.needs_review + group.qa_fail + group.generated) dots.push({ color: "#8b5cf6", label: "generated" });
    else dots.push({ color: "rgba(255,255,255,0.15)", label: "draft" });
  }
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {dots.map((d, i) => (
        <div
          key={i}
          title={d.label}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            backgroundColor: d.color,
          }}
        />
      ))}
    </div>
  );
}

async function streamNDJSON(
  url: string,
  body: Record<string, unknown>,
  onStep: (step: PipelineStep) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try { onStep(JSON.parse(line)); } catch { /* skip */ }
    }
  }
}

// ── Main Component ──

export default function PipelineRunner() {
  // Phase management
  const [phase, setPhase] = useState<"idle" | "planning" | "planned" | "generating">("idle");
  const [planSteps, setPlanSteps] = useState<PipelineStep[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);

  // Topic queue
  const [topics, setTopics] = useState<TopicGroup[]>([]);
  const [activeTopicKey, setActiveTopicKey] = useState<string | null>(null);
  const [topicSteps, setTopicSteps] = useState<PipelineStep[]>([]);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/pipeline/topics");
      if (!res.ok) return;
      const data = await res.json();
      const groups = data.groups ?? [];
      setTopics(groups);
      // If there are existing briefs, go straight to planned phase
      if (groups.length > 0 && phase === "idle") setPhase("planned");
    } catch { /* ignore */ }
  }, [phase]);

  // On mount, check if there are already planned topics
  useEffect(() => { void fetchTopics(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 1: Plan ──

  async function runPlan() {
    setPhase("planning");
    setPlanSteps([]);
    setPlanError(null);
    setTopics([]);

    try {
      await streamNDJSON(
        "/api/agents/pipeline/run",
        { scope: "full", planOnly: true },
        (step) => {
          setPlanSteps((prev) => {
            const idx = prev.findIndex((s) => s.step === step.step);
            if (idx >= 0) { const u = [...prev]; u[idx] = step; return u; }
            return [...prev, step];
          });
        },
      );
      await fetchTopics();
      setPhase("planned");
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }

  // ── Phase 2: Generate one topic ──

  async function generateTopic(level: string, topicSlug: string) {
    const key = `${level}|${topicSlug}`;
    setActiveTopicKey(key);
    setTopicSteps([]);
    setPhase("generating");

    try {
      await streamNDJSON(
        "/api/studio/pipeline/generate-topic",
        { level, topicSlug },
        (step) => {
          setTopicSteps((prev) => {
            const idx = prev.findIndex((s) => s.step === step.step);
            if (idx >= 0) { const u = [...prev]; u[idx] = step; return u; }
            return [...prev, step];
          });
        },
      );
      await fetchTopics();
    } catch { /* error shown in steps */ }
    finally {
      setActiveTopicKey(null);
      setPhase("planned");
    }
  }

  // ── Stats ──
  const totalBriefs = topics.reduce((s, t) => s + t.total, 0);
  const totalPublished = topics.reduce((s, t) => s + t.published, 0);
  const totalApproved = topics.reduce((s, t) => s + t.approved, 0);
  const totalDraft = topics.reduce((s, t) => s + t.draft, 0);
  const topicsDone = topics.filter((t) => t.draft === 0 && t.published + t.approved === t.total).length;

  // Group topics by level for display
  const byLevel = new Map<string, TopicGroup[]>();
  for (const t of topics) {
    const arr = byLevel.get(t.level) ?? [];
    arr.push(t);
    byLevel.set(t.level, arr);
  }

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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6" }}>
            Pipeline
          </p>
          <h3 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--foreground)" }}>
            {phase === "idle" ? "Crear journey" : phase === "planning" ? "Planificando..." : "Topic por topic"}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            {phase === "idle"
              ? "Paso 1: Planifica la estructura. Paso 2: Genera tema por tema."
              : phase === "planned" || phase === "generating"
                ? `${topicsDone}/${topics.length} topics completos — ${totalPublished} publicadas, ${totalDraft} pendientes`
                : "Analizando catálogo y creando briefs..."}
          </p>
        </div>

        {phase === "idle" && (
          <button
            onClick={() => void runPlan()}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              backgroundColor: "var(--primary)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Planificar journey
          </button>
        )}

        {(phase === "planned" || phase === "generating") && (
          <button
            onClick={() => { setPhase("idle"); setTopics([]); setPlanSteps([]); setTopicSteps([]); }}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid var(--card-border)",
              backgroundColor: "transparent",
              color: "var(--muted)",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Reiniciar
          </button>
        )}
      </div>

      {/* Plan error */}
      {planError && (
        <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{planError}</p>
      )}

      {/* Phase 1: Plan steps */}
      {(phase === "planning" || (phase !== "idle" && planSteps.length > 0)) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {planSteps.map((step) => (
            <div key={step.step} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
              <span>{STEP_ICONS[step.status] ?? "⏳"}</span>
              <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{STEP_LABELS[step.step] ?? step.step}</span>
              {step.detail && <span>— {step.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Phase 2: Topic queue */}
      {(phase === "planned" || phase === "generating") && topics.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from(byLevel.entries()).map(([level, levelTopics]) => (
            <div key={level} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
                <LevelBadge level={level} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {levelTopics.filter((t) => t.draft === 0).length}/{levelTopics.length} topics completos
                </span>
              </div>

              {levelTopics.map((topic) => {
                const key = `${topic.level}|${topic.topicSlug}`;
                const isActive = activeTopicKey === key;
                const isDone = topic.draft === 0 && (topic.published + topic.approved) === topic.total;
                const hasFailures = topic.qa_fail > 0 || topic.needs_review > 0;

                return (
                  <div key={key}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        backgroundColor: isActive
                          ? "rgba(20, 184, 166, 0.06)"
                          : isDone
                            ? "rgba(34, 197, 94, 0.04)"
                            : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          isActive ? "rgba(20, 184, 166, 0.3)" : isDone ? "rgba(34, 197, 94, 0.2)" : "var(--card-border)"
                        }`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                            {topic.topicSlug}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            {topic.total} historias
                          </span>
                          {isDone && <span style={{ fontSize: 11, color: "#22c55e" }}>completo</span>}
                          {hasFailures && !isDone && <span style={{ fontSize: 11, color: "#f59e0b" }}>necesita revisión</span>}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <ProgressDots group={topic} />
                        </div>
                      </div>

                      <button
                        onClick={() => void generateTopic(topic.level, topic.topicSlug)}
                        disabled={phase === "generating" || isDone || topic.draft === 0}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: "none",
                          backgroundColor:
                            isDone || topic.draft === 0
                              ? "rgba(255,255,255,0.05)"
                              : phase === "generating"
                                ? "var(--muted)"
                                : "#14b8a6",
                          color: isDone || topic.draft === 0 ? "var(--muted)" : "#fff",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: phase === "generating" || isDone || topic.draft === 0 ? "not-allowed" : "pointer",
                          opacity: phase === "generating" && !isActive ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isActive ? "Generando..." : isDone ? "Hecho" : `Generar (${topic.draft})`}
                      </button>
                    </div>

                    {/* Inline steps for active topic */}
                    {isActive && topicSteps.length > 0 && (
                      <div style={{ paddingLeft: 28, paddingTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {topicSteps.map((step) => (
                          <div key={step.step} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                            <span>{step.step === "budget-exhausted" ? "⚠️" : STEP_ICONS[step.status] ?? "⏳"}</span>
                            <span style={{ fontWeight: 600 }}>{STEP_LABELS[step.step] ?? step.step}</span>
                            {step.detail && <span>— {step.detail}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Empty state after plan with no topics */}
      {phase === "planned" && topics.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          No se encontraron gaps. El journey ya está completo o la directriz no tiene idiomas/niveles configurados.
        </p>
      )}
    </div>
  );
}
