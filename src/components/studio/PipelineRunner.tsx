"use client";

import { useState } from "react";

type PipelineStep = {
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  detail?: string;
  data?: Record<string, unknown>;
};

const STEP_LABELS: Record<string, string> = {
  directive: "Directriz",
  bootstrap: "Estructura de journey",
  planner: "Planner Agent",
  content: "Content Agent",
  qa: "QA Agent",
  retry: "Auto-retry QA",
  promote: "Promoción automática",
  publish: "Publicación",
  done: "Pipeline completo",
  error: "Error",
};

const STEP_ICONS: Record<string, string> = {
  running: "⏳",
  completed: "✅",
  failed: "❌",
  skipped: "⏭️",
};

export default function PipelineRunner() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runPipeline() {
    setRunning(true);
    setSteps([]);
    setError(null);

    try {
      const res = await fetch("/api/agents/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "full", contentLimit: 5, concurrency: 3 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
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
          try {
            const step = JSON.parse(line) as PipelineStep;
            setSteps((prev) => {
              const idx = prev.findIndex((s) => s.step === step.step);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = step;
                return updated;
              }
              return [...prev, step];
            });
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const isDone = steps.some((s) => s.step === "done" || s.step === "error");

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            Pipeline
          </p>
          <h3 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--foreground)" }}>
            Ejecutar pipeline completo
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Planner → Content (paralelo) → QA → Auto-retry → Promoción → Publicación
          </p>
        </div>
        <button
          onClick={() => void runPipeline()}
          disabled={running}
          style={{
            height: 40,
            padding: "0 20px",
            borderRadius: 10,
            border: "none",
            backgroundColor: running ? "var(--muted)" : "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: running ? "progress" : "pointer",
            opacity: running ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {running ? "Ejecutando..." : "Ejecutar pipeline"}
        </button>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{error}</p>
      )}

      {steps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {steps.map((step) => (
            <div
              key={step.step}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 8,
                backgroundColor: step.status === "failed" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${step.status === "failed" ? "rgba(239,68,68,0.3)" : "var(--card-border)"}`,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1.4 }}>
                {STEP_ICONS[step.status] ?? "⏳"}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  {STEP_LABELS[step.step] ?? step.step}
                </p>
                {step.detail && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
