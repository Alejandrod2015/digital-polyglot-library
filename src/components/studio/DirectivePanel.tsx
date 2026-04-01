"use client";

import { useEffect, useState } from "react";
import type { ContentDirective, PipelineBudget } from "@/agents/config/directive";
import { DEFAULT_BUDGET } from "@/agents/config/directive";

const LANGUAGE_MAP: Record<string, string> = {
  es: "Español",
  pt: "Portugués",
  fr: "Francés",
  it: "Italiano",
  de: "Alemán",
  ko: "Coreano",
  en: "Inglés",
};

const LEVELS = ["a1", "a2", "b1", "b2", "c1"];

export default function DirectivePanel() {
  const [directive, setDirective] = useState<ContentDirective | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        const directive = data.directive || data;
        setDirective(directive);
        setLanguages(directive.languages);
        setLevels(directive.levels);
        setTopics(directive.topics.join(", "));
        setStoriesPerSlot(directive.storiesPerSlot);
        setNote(directive.note);
        setActive(directive.active);
        if (directive.budget) setBudget({ ...DEFAULT_BUDGET, ...directive.budget });
      } catch (err) {
        setMessage({ type: "error", text: "No se pudo cargar la directriz" });
      } finally {
        setLoading(false);
      }
    }
    fetchDirective();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const topicList = topics
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => t.toLowerCase());

      const updated: ContentDirective = {
        languages,
        levels,
        topics: topicList,
        storiesPerSlot,
        note,
        active,
        updatedBy: "studio-ui",
        updatedAt: new Date().toISOString(),
        budget,
      };

      const res = await fetch("/api/agents/directive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      const saved = data.directive || data;
      setDirective(saved);
      setMessage({ type: "success", text: "Directriz guardada correctamente" });
    } catch (err) {
      setMessage({ type: "error", text: "Error al guardar la directriz" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#14b8a6",
          }}
        >
          Directriz de contenido
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: 20, color: "var(--foreground)", fontWeight: 700 }}>
          Visión del director
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Define qué idiomas, niveles y temas queremos este mes
        </p>
      </div>

      {/* Form Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
        }}
      >
        {/* Languages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Idiomas
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(LANGUAGE_MAP).map(([code, label]) => (
              <label
                key={code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={languages.includes(code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setLanguages([...languages, code]);
                    } else {
                      setLanguages(languages.filter((l) => l !== code));
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Levels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Niveles (CEFR)
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LEVELS.map((level) => (
              <label
                key={level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={levels.includes(level)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setLevels([...levels, level]);
                    } else {
                      setLevels(levels.filter((l) => l !== level));
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
                {level.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Topics */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          Temas prioritarios
        </label>
        <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--muted)" }}>
          Separados por comas (ej: "viajes, cultura, gastronomía") o déjalo vacío para todos
        </p>
        <input
          type="text"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="ej: viajes, cultura, negocios"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--card-border)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Stories per slot */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          Historias por nivel
        </label>
        <input
          type="number"
          min="1"
          max="20"
          value={storiesPerSlot}
          onChange={(e) => setStoriesPerSlot(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--card-border)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "inherit",
            maxWidth: 120,
          }}
        />
      </div>

      {/* Note */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          Nota
        </label>
        <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--muted)" }}>
          Contexto para los agentes (ej: "Lanzamiento Italia en mayo")
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Enfoque en contenido de viajes para el lanzamiento de primavera..."
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--card-border)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "inherit",
            minHeight: 80,
            resize: "vertical",
          }}
        />
      </div>

      {/* Budget & Limits */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: "1px solid var(--card-border)" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f59e0b" }}>
            Presupuesto y límites
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Controlan cuántos recursos consume cada ejecución del pipeline
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Max historias/run</label>
            <input type="number" min={1} max={100} value={budget.maxStoriesPerRun}
              onChange={(e) => setBudget({ ...budget, maxStoriesPerRun: Math.max(1, parseInt(e.target.value) || 10) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Max LLM calls/run</label>
            <input type="number" min={1} max={500} value={budget.maxLLMCallsPerRun}
              onChange={(e) => setBudget({ ...budget, maxLLMCallsPerRun: Math.max(1, parseInt(e.target.value) || 50) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Max duración (min)</label>
            <input type="number" min={1} max={60} value={budget.maxRunDurationMinutes}
              onChange={(e) => setBudget({ ...budget, maxRunDurationMinutes: Math.max(1, parseInt(e.target.value) || 15) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Max reintentos/historia</label>
            <input type="number" min={0} max={5} value={budget.maxRetriesPerStory}
              onChange={(e) => setBudget({ ...budget, maxRetriesPerStory: Math.max(0, parseInt(e.target.value) || 2) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>QA mínimo para aprobar</label>
            <input type="number" min={0} max={100} value={budget.minQAScore}
              onChange={(e) => setBudget({ ...budget, minQAScore: Math.max(0, Math.min(100, parseInt(e.target.value) || 85)) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13, fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={budget.enableLLMQA}
              onChange={(e) => setBudget({ ...budget, enableLLMQA: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
            QA con LLM (calidad narrativa, CEFR, cultural)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)", cursor: "pointer" }}>
            <input type="checkbox" checked={budget.autoRetryQA}
              onChange={(e) => setBudget({ ...budget, autoRetryQA: e.target.checked })}
              style={{ cursor: "pointer" }}
            />
            Auto-reintentar historias que fallen QA
          </label>
        </div>
      </div>

      {/* Active toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
            Directriz activa
          </span>
        </label>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {active ? "El pipeline usará esta directriz" : "Desactivada"}
        </span>
      </div>

      {/* Last updated info */}
      {directive && (
        <div style={{ fontSize: 12, color: "var(--muted)", paddingTop: 8, borderTop: "1px solid var(--card-border)" }}>
          <p style={{ margin: 0 }}>
            Última actualización: {new Date(directive.updatedAt).toLocaleString("es-ES")}
          </p>
          {directive.updatedBy && (
            <p style={{ margin: "2px 0 0" }}>Por: {directive.updatedBy}</p>
          )}
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            backgroundColor: message.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: message.type === "success" ? "#22c55e" : "#ef4444",
            fontSize: 13,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={() => void handleSave()}
        disabled={saving || languages.length === 0 || levels.length === 0}
        style={{
          padding: "12px 20px",
          borderRadius: 10,
          border: "none",
          backgroundColor:
            saving || languages.length === 0 || levels.length === 0
              ? "var(--muted)"
              : "#14b8a6",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          cursor:
            saving || languages.length === 0 || levels.length === 0
              ? "not-allowed"
              : "pointer",
          opacity: saving || languages.length === 0 || levels.length === 0 ? 0.6 : 1,
          alignSelf: "flex-start",
        }}
      >
        {saving ? "Guardando..." : "Guardar directriz"}
      </button>
    </div>
  );
}
