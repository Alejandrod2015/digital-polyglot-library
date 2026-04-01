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
  a1: "#22c55e", a2: "#84cc16", b1: "#eab308", b2: "#f97316", c1: "#ef4444", c2: "#a855f7",
};

const STEP_LABELS: Record<string, string> = {
  directive: "Directriz", bootstrap: "Estructura", planner: "Planner",
  content: "Content Agent", qa: "QA", retry: "Retry",
  promote: "Promote", publish: "Publish", covers: "Covers",
  "budget-exhausted": "Presupuesto", done: "Listo", error: "Error",
};

const STEP_ICONS: Record<string, string> = {
  running: "⏳", completed: "✅", failed: "❌", skipped: "⏭️",
};

function MiniBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", borderRadius: 2, backgroundColor: pct === 100 ? "#22c55e" : "#14b8a6", width: `${pct}%`, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{done}/{total}</span>
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
  const [phase, setPhase] = useState<"idle" | "planning" | "planned" | "generating">("idle");
  const [planSteps, setPlanSteps] = useState<PipelineStep[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicGroup[]>([]);
  const [activeTopicKey, setActiveTopicKey] = useState<string | null>(null);
  const [topicSteps, setTopicSteps] = useState<PipelineStep[]>([]);
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set());

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/pipeline/topics");
      if (!res.ok) return;
      const data = await res.json();
      const groups = data.groups ?? [];
      setTopics(groups);
      if (groups.length > 0 && phase === "idle") setPhase("planned");
    } catch { /* ignore */ }
  }, [phase]);

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
  function addStep(step: PipelineStep) {
    setTopicSteps((prev) => {
      const idx = prev.findIndex((s) => s.step === step.step);
      if (idx >= 0) { const u = [...prev]; u[idx] = step; return u; }
      return [...prev, step];
    });
  }

  async function generateTopic(level: string, topicSlug: string) {
    const key = `${level}|${topicSlug}`;
    setActiveTopicKey(key);
    setTopicSteps([]);
    setPhase("generating");
    // Auto-expand this level
    setCollapsedLevels((prev) => { const n = new Set(prev); n.delete(level); return n; });

    try {
      const collectedSteps: PipelineStep[] = [];
      await streamNDJSON(
        "/api/studio/pipeline/generate-topic",
        { level, topicSlug },
        (step) => { collectedSteps.push(step); addStep(step); },
      );

      // Auto-chain covers
      const publishStep = collectedSteps.find((s) => s.step === "publish" && s.data?.publishedStories);
      const publishedStories = (publishStep?.data?.publishedStories ?? []) as Array<{ draftId: string; sanityId: string }>;
      if (publishedStories.length > 0) {
        addStep({ step: "covers", status: "running", detail: `0/${publishedStories.length}` });
        let coverOk = 0, coverFail = 0;
        for (const { sanityId, draftId } of publishedStories) {
          try {
            const res = await fetch("/api/studio/pipeline/generate-cover", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sanityId, draftId }),
            });
            const data = await res.json();
            if (data.success) coverOk++; else coverFail++;
          } catch { coverFail++; }
          addStep({ step: "covers", status: "running", detail: `${coverOk + coverFail}/${publishedStories.length}` });
        }
        addStep({
          step: "covers",
          status: coverFail === publishedStories.length ? "failed" : "completed",
          detail: `${coverOk} ok${coverFail > 0 ? `, ${coverFail} fail` : ""}`,
        });
      }
      await fetchTopics();
    } catch { /* error shown in steps */ }
    finally { setActiveTopicKey(null); setPhase("planned"); }
  }

  // ── Stats ──
  const totalPublished = topics.reduce((s, t) => s + t.published, 0);
  const totalDraft = topics.reduce((s, t) => s + t.draft, 0);
  const totalDone = topics.reduce((s, t) => s + t.published + t.approved, 0);
  const totalAll = topics.reduce((s, t) => s + t.total, 0);
  const topicsDone = topics.filter((t) => t.draft === 0 && t.published + t.approved === t.total).length;

  const byLevel = new Map<string, TopicGroup[]>();
  for (const t of topics) {
    const arr = byLevel.get(t.level) ?? [];
    arr.push(t);
    byLevel.set(t.level, arr);
  }

  function toggleLevel(level: string) {
    setCollapsedLevels((prev) => {
      const n = new Set(prev);
      if (n.has(level)) n.delete(level); else n.add(level);
      return n;
    });
  }

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6" }}>Pipeline</p>
          {(phase === "planned" || phase === "generating") && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {topicsDone}/{topics.length} topics — {totalDone}/{totalAll} historias
            </span>
          )}
          {(phase === "planned" || phase === "generating") && totalAll > 0 && (
            <MiniBar done={totalDone} total={totalAll} />
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {phase === "idle" && (
            <button onClick={() => void runPlan()} style={{ height: 32, padding: "0 16px", borderRadius: 8, border: "none", backgroundColor: "var(--primary)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Planificar journey
            </button>
          )}
          {(phase === "planned" || phase === "generating") && (
            <button onClick={() => { setPhase("idle"); setTopics([]); setPlanSteps([]); setTopicSteps([]); }} style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "transparent", color: "var(--muted)", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* ── Plan steps (inline, compact) ── */}
      {planError && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{planError}</p>}
      {(phase === "planning" || (phase !== "idle" && planSteps.length > 0)) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11, color: "var(--muted)" }}>
          {planSteps.map((step) => (
            <span key={step.step}>{STEP_ICONS[step.status] ?? "⏳"} {STEP_LABELS[step.step] ?? step.step}</span>
          ))}
        </div>
      )}

      {/* ── Topic queue ── */}
      {(phase === "planned" || phase === "generating") && topics.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Array.from(byLevel.entries()).map(([level, levelTopics]) => {
            const isCollapsed = collapsedLevels.has(level);
            const levelDone = levelTopics.filter((t) => t.draft === 0 && t.published + t.approved === t.total).length;
            const levelTotal = levelTopics.reduce((s, t) => s + t.published + t.approved, 0);
            const levelAll = levelTopics.reduce((s, t) => s + t.total, 0);
            const hasActive = levelTopics.some((t) => activeTopicKey === `${t.level}|${t.topicSlug}`);

            return (
              <div key={level}>
                {/* Level header — clickable to collapse */}
                <div
                  onClick={() => toggleLevel(level)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, backgroundColor: hasActive ? "rgba(20, 184, 166, 0.04)" : "transparent", userSelect: "none" }}
                >
                  <span style={{ fontSize: 10, color: "var(--muted)", width: 12, textAlign: "center" }}>{isCollapsed ? "▸" : "▾"}</span>
                  <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, color: "#fff", backgroundColor: LEVEL_COLORS[level.toLowerCase()] ?? "#6b7280", textTransform: "uppercase" }}>{level}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{levelDone}/{levelTopics.length} topics</span>
                  <MiniBar done={levelTotal} total={levelAll} />
                </div>

                {/* Topic rows */}
                {!isCollapsed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 20 }}>
                    {levelTopics.map((topic) => {
                      const key = `${topic.level}|${topic.topicSlug}`;
                      const isActive = activeTopicKey === key;
                      const isDone = topic.draft === 0 && (topic.published + topic.approved) === topic.total;

                      return (
                        <div key={key}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 4,
                            backgroundColor: isActive ? "rgba(20, 184, 166, 0.06)" : "transparent",
                            fontSize: 12,
                          }}>
                            {/* Status indicator */}
                            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: isDone ? "#22c55e" : topic.draft < topic.total ? "#f59e0b" : "rgba(255,255,255,0.15)", flexShrink: 0 }} />

                            {/* Topic name */}
                            <span style={{ flex: 1, color: isDone ? "var(--muted)" : "var(--foreground)", fontWeight: isActive ? 600 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {topic.topicSlug.replace(/-/g, " ")}
                            </span>

                            {/* Count */}
                            <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{topic.published + topic.approved}/{topic.total}</span>

                            {/* Button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); void generateTopic(topic.level, topic.topicSlug); }}
                              disabled={phase === "generating" || isDone || topic.draft === 0}
                              style={{
                                padding: "2px 10px", borderRadius: 4, border: "none", fontSize: 10, fontWeight: 600, cursor: phase === "generating" || isDone || topic.draft === 0 ? "not-allowed" : "pointer", flexShrink: 0,
                                backgroundColor: isDone || topic.draft === 0 ? "transparent" : phase === "generating" ? "rgba(255,255,255,0.05)" : "#14b8a6",
                                color: isDone || topic.draft === 0 ? "var(--muted)" : phase === "generating" && !isActive ? "var(--muted)" : "#fff",
                                opacity: phase === "generating" && !isActive ? 0.4 : 1,
                              }}
                            >
                              {isActive ? "..." : isDone ? "ok" : `Generar`}
                            </button>
                          </div>

                          {/* Inline steps for active topic */}
                          {isActive && topicSteps.length > 0 && (
                            <div style={{ paddingLeft: 22, paddingBottom: 4, display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10, color: "var(--muted)" }}>
                              {topicSteps.map((step) => (
                                <span key={step.step}>
                                  {step.step === "budget-exhausted" ? "⚠️" : STEP_ICONS[step.status] ?? "⏳"} {STEP_LABELS[step.step] ?? step.step}{step.detail ? ` ${step.detail}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {phase === "idle" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Planifica la estructura del journey. Luego genera tema por tema.
        </p>
      )}
      {phase === "planned" && topics.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          No se encontraron gaps. El journey ya está completo o la directriz no tiene idiomas/niveles configurados.
        </p>
      )}
    </div>
  );
}
