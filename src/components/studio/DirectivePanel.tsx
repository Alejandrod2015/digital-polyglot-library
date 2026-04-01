"use client";

import { useEffect, useState } from "react";
import type { ContentDirective, PipelineBudget } from "@/agents/config/directive";
import { DEFAULT_BUDGET } from "@/agents/config/directive";

const LANGUAGE_MAP: Record<string, string> = {
  es: "ES", pt: "PT", fr: "FR", it: "IT", de: "DE", ko: "KO", en: "EN",
};

const LANGUAGE_LABELS: Record<string, string> = {
  es: "Español", pt: "Portugués", fr: "Francés", it: "Italiano", de: "Alemán", ko: "Coreano", en: "Inglés",
};

const LEVELS = ["a1", "a2", "b1", "b2", "c1"];

const inputStyle: React.CSSProperties = {
  padding: "6px 8px", borderRadius: 6, border: "1px solid var(--card-border)",
  backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, fontFamily: "inherit",
};

export default function DirectivePanel() {
  const [directive, setDirective] = useState<ContentDirective | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showBudget, setShowBudget] = useState(false);

  const [languages, setLanguages] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [topics, setTopics] = useState<string>("");
  const [storiesPerSlot, setStoriesPerSlot] = useState(4);
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [budget, setBudget] = useState<PipelineBudget>(DEFAULT_BUDGET);

  useEffect(() => {
    async function fetchDirective() {
      try {
        const res = await fetch("/api/agents/directive");
        if (!res.ok) throw new Error("Failed to fetch directive");
        const data = await res.json();
        const d = data.directive || data;
        setDirective(d);
        setLanguages(d.languages);
        setLevels(d.levels);
        setTopics(d.topics.join(", "));
        setStoriesPerSlot(d.storiesPerSlot);
        setNote(d.note);
        setActive(d.active);
        if (d.budget) setBudget({ ...DEFAULT_BUDGET, ...d.budget });
      } catch {
        setMessage({ type: "error", text: "No se pudo cargar la directriz" });
      } finally { setLoading(false); }
    }
    fetchDirective();
  }, []);

  async function handleSave() {
    setSaving(true); setMessage(null);
    try {
      const topicList = topics.split(",").map((t) => t.trim()).filter((t) => t.length > 0).map((t) => t.toLowerCase());
      const updated: ContentDirective = { languages, levels, topics: topicList, storiesPerSlot, note, active, updatedBy: "studio-ui", updatedAt: new Date().toISOString(), budget };
      const res = await fetch("/api/agents/directive", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setDirective(data.directive || data);
      setMessage({ type: "success", text: "Guardada" });
    } catch { setMessage({ type: "error", text: "Error al guardar" }); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 16, borderRadius: 12, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}><p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>Cargando...</p></div>;

  return (
    <div style={{ padding: 16, borderRadius: 12, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6" }}>Directriz</p>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: active ? "#14b8a6" : "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ cursor: "pointer" }} />
            {active ? "Activa" : "Inactiva"}
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {message && <span style={{ fontSize: 11, color: message.type === "success" ? "#22c55e" : "#ef4444" }}>{message.text}</span>}
          <button onClick={() => void handleSave()} disabled={saving || languages.length === 0 || levels.length === 0}
            style={{ height: 28, padding: "0 14px", borderRadius: 6, border: "none", backgroundColor: saving || languages.length === 0 ? "var(--muted)" : "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 11, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Main grid: Languages + Levels + Settings side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {/* Languages as pill toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Idiomas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Object.entries(LANGUAGE_MAP).map(([code, short]) => {
              const selected = languages.includes(code);
              return (
                <button key={code} onClick={() => setLanguages(selected ? languages.filter((l) => l !== code) : [...languages, code])}
                  title={LANGUAGE_LABELS[code]}
                  style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${selected ? "#14b8a6" : "var(--card-border)"}`, backgroundColor: selected ? "rgba(20,184,166,0.15)" : "transparent", color: selected ? "#14b8a6" : "var(--muted)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {short}
                </button>
              );
            })}
          </div>
        </div>

        {/* Levels as pill toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Niveles</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LEVELS.map((level) => {
              const selected = levels.includes(level);
              return (
                <button key={level} onClick={() => setLevels(selected ? levels.filter((l) => l !== level) : [...levels, level])}
                  style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${selected ? "#14b8a6" : "var(--card-border)"}`, backgroundColor: selected ? "rgba(20,184,166,0.15)" : "transparent", color: selected ? "#14b8a6" : "var(--muted)", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stories per slot */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Historias/slot</label>
          <input type="number" min={1} max={20} value={storiesPerSlot}
            onChange={(e) => setStoriesPerSlot(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ ...inputStyle, maxWidth: 70 }} />
        </div>
      </div>

      {/* Topics + Note in one row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Temas prioritarios <span style={{ fontWeight: 400 }}>(vacío = todos)</span></label>
          <input type="text" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="viajes, cultura, negocios" style={inputStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Nota para agentes</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Lanzamiento Italia en mayo" style={inputStyle} />
        </div>
      </div>

      {/* Budget — collapsible */}
      <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: 8 }}>
        <div onClick={() => setShowBudget(!showBudget)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
          <span style={{ fontSize: 10, color: "var(--muted)" }}>{showBudget ? "▾" : "▸"}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#f59e0b" }}>Presupuesto</span>
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            {budget.maxStoriesPerRun} hist/run, {budget.maxLLMCallsPerRun} LLM calls, QA {budget.enableLLMQA ? "LLM" : "estructural"}
          </span>
        </div>

        {showBudget && (
          <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 10, color: "var(--muted)" }}>Hist/run</label>
                <input type="number" min={1} max={100} value={budget.maxStoriesPerRun} onChange={(e) => setBudget({ ...budget, maxStoriesPerRun: Math.max(1, parseInt(e.target.value) || 10) })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 10, color: "var(--muted)" }}>LLM/run</label>
                <input type="number" min={1} max={500} value={budget.maxLLMCallsPerRun} onChange={(e) => setBudget({ ...budget, maxLLMCallsPerRun: Math.max(1, parseInt(e.target.value) || 50) })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 10, color: "var(--muted)" }}>Max min</label>
                <input type="number" min={1} max={60} value={budget.maxRunDurationMinutes} onChange={(e) => setBudget({ ...budget, maxRunDurationMinutes: Math.max(1, parseInt(e.target.value) || 15) })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 10, color: "var(--muted)" }}>Retries</label>
                <input type="number" min={0} max={5} value={budget.maxRetriesPerStory} onChange={(e) => setBudget({ ...budget, maxRetriesPerStory: Math.max(0, parseInt(e.target.value) || 2) })} style={inputStyle} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <label style={{ fontSize: 10, color: "var(--muted)" }}>QA min</label>
                <input type="number" min={0} max={100} value={budget.minQAScore} onChange={(e) => setBudget({ ...budget, minQAScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 85)) })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={budget.enableLLMQA} onChange={(e) => setBudget({ ...budget, enableLLMQA: e.target.checked })} style={{ cursor: "pointer" }} />
                QA con LLM
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={budget.autoRetryQA} onChange={(e) => setBudget({ ...budget, autoRetryQA: e.target.checked })} style={{ cursor: "pointer" }} />
                Auto-retry QA
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Last updated */}
      {directive && (
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          Actualizado: {new Date(directive.updatedAt).toLocaleString("es-ES")}{directive.updatedBy ? ` por ${directive.updatedBy}` : ""}
        </div>
      )}
    </div>
  );
}
