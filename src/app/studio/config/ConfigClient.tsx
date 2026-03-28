"use client";

import { useCallback, useEffect, useState } from "react";

/* ── Types ───────────────────────────────────────────────── */
type PedagogicalRule = {
  level: string;
  label: string;
  wordCountRange: { min: number; max: number };
  sentenceComplexity: "simple" | "compound" | "complex" | "advanced";
  grammarStructures: string[];
  vocabDensity: { minItems: number; maxItems: number };
  vocabType: string;
  toneGuidance: string;
  exampleTopics: string[];
};

type ConfigResponse = {
  source: "database" | "defaults";
  rules: Record<string, PedagogicalRule>;
  updatedBy: string | null;
  updatedAt: string | null;
};

/* ── Constants ───────────────────────────────────────────── */
const ACCENT = "#14b8a6";
const ACCENT_SOFT = "rgba(20, 184, 166, 0.15)";
const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;

const LEVEL_COLORS: Record<string, string> = {
  a1: "#22c55e",
  a2: "#84cc16",
  b1: "#eab308",
  b2: "#f97316",
  c1: "#ef4444",
  c2: "#a855f7",
};

const COMPLEXITY_OPTIONS = [
  { value: "simple", label: "Simple" },
  { value: "compound", label: "Compound" },
  { value: "complex", label: "Complex" },
  { value: "advanced", label: "Advanced" },
];

const VOCAB_TYPE_OPTIONS = [
  { value: "concrete", label: "Concrete" },
  { value: "mixed", label: "Mixed" },
  { value: "abstract", label: "Abstract" },
  { value: "specialized", label: "Specialized" },
  { value: "literary", label: "Literary" },
];

/* ── Styles ──────────────────────────────────────────────── */
const card: React.CSSProperties = {
  borderRadius: 10,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  height: 36,
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "auto" as const,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "8px 10px",
  fontSize: 13,
  outline: "none",
  resize: "vertical" as const,
  fontFamily: "inherit",
  minHeight: 60,
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: "none",
  backgroundColor: ACCENT,
  color: "#fff",
  padding: "0 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "transparent",
  border: "1px solid var(--card-border)",
  color: "var(--foreground)",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  marginBottom: 4,
  letterSpacing: "0.02em",
};

/* ── Component ───────────────────────────────────────────── */
export default function ConfigClient() {
  const [rules, setRules] = useState<Record<string, PedagogicalRule> | null>(null);
  const [source, setSource] = useState<"database" | "defaults">("defaults");
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string>("a1");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // ── Load config ──
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/studio/config");
      if (!res.ok) throw new Error("Failed to load config");
      const data: ConfigResponse = await res.json();
      setRules(data.rules);
      setSource(data.source);
      setUpdatedBy(data.updatedBy);
      setUpdatedAt(data.updatedAt);
      setHasChanges(false);
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Save config ──
  const saveConfig = async () => {
    if (!rules) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/studio/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSource("database");
      setUpdatedBy(data.updatedBy);
      setUpdatedAt(data.updatedAt);
      setHasChanges(false);
      setMessage({ text: "Guardado correctamente", type: "ok" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to defaults ──
  const resetToDefaults = async () => {
    if (!confirm("Esto eliminará tus reglas personalizadas y restaurará los valores por defecto. ¿Continuar?")) return;
    try {
      await fetch("/api/studio/config", { method: "DELETE" });
      await loadConfig();
      setMessage({ text: "Restaurado a valores por defecto", type: "ok" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  // ── Update a field in current level ──
  const updateField = (field: string, value: unknown) => {
    if (!rules) return;
    setRules({
      ...rules,
      [activeLevel]: { ...rules[activeLevel], [field]: value },
    });
    setHasChanges(true);
  };

  const updateNested = (field: string, subfield: string, value: unknown) => {
    if (!rules) return;
    const current = rules[activeLevel][field as keyof PedagogicalRule] as Record<string, unknown>;
    setRules({
      ...rules,
      [activeLevel]: {
        ...rules[activeLevel],
        [field]: { ...current, [subfield]: value },
      },
    });
    setHasChanges(true);
  };

  if (loading || !rules) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Cargando configuración...</div>;
  }

  const rule = rules[activeLevel];
  if (!rule) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Status bar ── */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 16, padding: "12px 20px" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          backgroundColor: source === "database" ? ACCENT : "#eab308",
        }} />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {source === "database" ? "Reglas personalizadas" : "Valores por defecto"}
          {updatedBy && (
            <span> &mdash; editado por {updatedBy}</span>
          )}
          {updatedAt && (
            <span style={{ opacity: 0.6 }}> ({new Date(updatedAt).toLocaleDateString("es")})</span>
          )}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {source === "database" && (
            <button style={btnSecondary} onClick={resetToDefaults}>
              Restaurar defaults
            </button>
          )}
          <button
            style={{ ...btnPrimary, opacity: hasChanges ? 1 : 0.5 }}
            onClick={saveConfig}
            disabled={saving || !hasChanges}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: "10px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          backgroundColor: message.type === "ok" ? "rgba(20, 184, 166, 0.12)" : "rgba(239, 68, 68, 0.12)",
          color: message.type === "ok" ? ACCENT : "#ef4444",
          border: `1px solid ${message.type === "ok" ? "rgba(20, 184, 166, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        }}>
          {message.text}
        </div>
      )}

      {/* ── Level tabs ── */}
      <div style={{ display: "flex", gap: 6 }}>
        {LEVELS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(lvl)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: activeLevel === lvl ? `2px solid ${LEVEL_COLORS[lvl]}` : "1px solid var(--card-border)",
              backgroundColor: activeLevel === lvl ? `${LEVEL_COLORS[lvl]}18` : "var(--card-bg)",
              color: activeLevel === lvl ? LEVEL_COLORS[lvl] : "var(--muted)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <span>{lvl.toUpperCase()}</span>
            <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>{rules[lvl]?.label}</span>
          </button>
        ))}
      </div>

      {/* ── Rule editor ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Label */}
          <div style={card}>
            <span style={label}>Nombre del nivel</span>
            <input
              style={inputStyle}
              value={rule.label}
              onChange={(e) => updateField("label", e.target.value)}
            />
          </div>

          {/* Word count */}
          <div style={card}>
            <span style={label}>Rango de palabras</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                style={{ ...inputStyle, width: 100 }}
                value={rule.wordCountRange.min}
                onChange={(e) => updateNested("wordCountRange", "min", parseInt(e.target.value) || 0)}
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>a</span>
              <input
                type="number"
                style={{ ...inputStyle, width: 100 }}
                value={rule.wordCountRange.max}
                onChange={(e) => updateNested("wordCountRange", "max", parseInt(e.target.value) || 0)}
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>palabras</span>
            </div>
          </div>

          {/* Sentence complexity */}
          <div style={card}>
            <span style={label}>Complejidad oracional</span>
            <select
              style={selectStyle}
              value={rule.sentenceComplexity}
              onChange={(e) => updateField("sentenceComplexity", e.target.value)}
            >
              {COMPLEXITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Vocab density */}
          <div style={card}>
            <span style={label}>Vocabulario a enseñar (items)</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="number"
                style={{ ...inputStyle, width: 80 }}
                value={rule.vocabDensity.minItems}
                onChange={(e) => updateNested("vocabDensity", "minItems", parseInt(e.target.value) || 0)}
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>a</span>
              <input
                type="number"
                style={{ ...inputStyle, width: 80 }}
                value={rule.vocabDensity.maxItems}
                onChange={(e) => updateNested("vocabDensity", "maxItems", parseInt(e.target.value) || 0)}
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>items</span>
            </div>
          </div>

          {/* Vocab type */}
          <div style={card}>
            <span style={label}>Tipo de vocabulario</span>
            <select
              style={selectStyle}
              value={rule.vocabType}
              onChange={(e) => updateField("vocabType", e.target.value)}
            >
              {VOCAB_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Tone */}
          <div style={card}>
            <span style={label}>Tono y estilo</span>
            <textarea
              style={{ ...textareaStyle, minHeight: 80 }}
              value={rule.toneGuidance}
              onChange={(e) => updateField("toneGuidance", e.target.value)}
            />
          </div>

          {/* Grammar structures */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={label}>Estructuras gramaticales ({rule.grammarStructures.length})</span>
              <button
                style={{
                  background: "none", border: "none", color: ACCENT,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 6px",
                }}
                onClick={() => {
                  updateField("grammarStructures", [...rule.grammarStructures, ""]);
                }}
              >
                + Agregar
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
              {rule.grammarStructures.map((gs, idx) => (
                <div key={idx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, height: 32, fontSize: 12 }}
                    value={gs}
                    onChange={(e) => {
                      const updated = [...rule.grammarStructures];
                      updated[idx] = e.target.value;
                      updateField("grammarStructures", updated);
                    }}
                    placeholder={`Estructura ${idx + 1}`}
                  />
                  <button
                    style={{
                      background: "none", border: "none", color: "#ef4444",
                      fontSize: 16, cursor: "pointer", padding: "0 4px", flexShrink: 0,
                      opacity: 0.6,
                    }}
                    title="Eliminar"
                    onClick={() => {
                      const updated = rule.grammarStructures.filter((_, i) => i !== idx);
                      updateField("grammarStructures", updated);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Example topics */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={label}>Temas de ejemplo ({rule.exampleTopics.length})</span>
              <button
                style={{
                  background: "none", border: "none", color: ACCENT,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 6px",
                }}
                onClick={() => {
                  updateField("exampleTopics", [...rule.exampleTopics, ""]);
                }}
              >
                + Agregar
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
              {rule.exampleTopics.map((topic, idx) => (
                <div key={idx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, height: 32, fontSize: 12 }}
                    value={topic}
                    onChange={(e) => {
                      const updated = [...rule.exampleTopics];
                      updated[idx] = e.target.value;
                      updateField("exampleTopics", updated);
                    }}
                    placeholder={`Tema ${idx + 1}`}
                  />
                  <button
                    style={{
                      background: "none", border: "none", color: "#ef4444",
                      fontSize: 16, cursor: "pointer", padding: "0 4px", flexShrink: 0,
                      opacity: 0.6,
                    }}
                    title="Eliminar"
                    onClick={() => {
                      const updated = rule.exampleTopics.filter((_, i) => i !== idx);
                      updateField("exampleTopics", updated);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div style={card}>
        <span style={{ ...label, marginBottom: 12 }}>Resumen de todos los niveles</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {LEVELS.map((lvl) => {
            const r = rules[lvl];
            if (!r) return null;
            return (
              <div
                key={lvl}
                onClick={() => setActiveLevel(lvl)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${activeLevel === lvl ? LEVEL_COLORS[lvl] : "var(--card-border)"}`,
                  backgroundColor: activeLevel === lvl ? `${LEVEL_COLORS[lvl]}10` : "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: LEVEL_COLORS[lvl], marginBottom: 4 }}>
                  {lvl.toUpperCase()} &mdash; {r.label}
                </div>
                <div style={{ color: "var(--muted)" }}>
                  {r.wordCountRange.min}&ndash;{r.wordCountRange.max} palabras
                </div>
                <div style={{ color: "var(--muted)" }}>
                  {r.vocabDensity.minItems}&ndash;{r.vocabDensity.maxItems} vocab
                </div>
                <div style={{ color: "var(--muted)" }}>
                  {r.grammarStructures.length} estructuras
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
