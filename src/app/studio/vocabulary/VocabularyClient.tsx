"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StudioToast, { showToast } from "@/components/studio/StudioToast";
import type { JourneySummary, VocabRow } from "@/lib/studioVocabulary";

type Props = {
  journeys: JourneySummary[];
  selectedId: string | null;
  rows: VocabRow[];
};

const TYPE_LABEL: Record<string, string> = {
  noun: "sustantivo",
  verb: "verbo",
  adjective: "adjetivo",
  adverb: "adverbio",
  expression: "expresión",
  slang: "slang",
  preposition: "preposición",
  unknown: "(sin tipo)",
};

const TYPE_COLOR: Record<string, string> = {
  noun: "#3b82f6",
  verb: "#10b981",
  adjective: "#f59e0b",
  adverb: "#8b5cf6",
  expression: "#ec4899",
  slang: "#ef4444",
  preposition: "#64748b",
  unknown: "#9ca3af",
};

export default function VocabularyClient({ journeys, selectedId, rows }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [conflictOnly, setConflictOnly] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pendingCanonical, setPendingCanonical] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.word.toLowerCase().includes(q) && !r.definitions.some((d) => d.definition.toLowerCase().includes(q))) {
        return false;
      }
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (conflictOnly && !r.hasConflict) return false;
      return true;
    });
  }, [rows, query, typeFilter, conflictOnly]);

  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.type, (map.get(r.type) ?? 0) + 1);
    return map;
  }, [rows]);

  const conflictCount = useMemo(() => rows.filter((r) => r.hasConflict).length, [rows]);
  const occurrencesTotal = useMemo(() => rows.reduce((s, r) => s + r.occurrences, 0), [rows]);

  async function applyCanonical(lemma: string, definition: string) {
    if (!selectedId) return;
    setPendingCanonical(lemma);
    try {
      const res = await fetch("/api/studio/vocabulary/canonical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: selectedId, lemma, definition }),
      });
      const json = (await res.json()) as { ok?: boolean; storiesTouched?: number; itemsUpdated?: number; error?: string };
      if (!res.ok || !json.ok) {
        showToast(`Error: ${json.error || res.status}`);
        return;
      }
      showToast(`✓ "${lemma}" canónica aplicada; ${json.itemsUpdated ?? 0} items en ${json.storiesTouched ?? 0} historias`);
      router.refresh();
    } catch (e) {
      showToast(`Error de red: ${e instanceof Error ? e.message : "?"}`);
    } finally {
      setPendingCanonical(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StudioToast />

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          padding: 16,
          borderRadius: 10,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div style={{ flex: "0 0 280px" }}>
          <Label>Journey</Label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => router.push(`/studio/vocabulary?journeyId=${e.target.value}`)}
            className="studio-input"
            style={input}
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} ({j.language}/{j.variant}) · {j.storyCount} hist.
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 200px", minWidth: 180 }}>
          <Label>Buscar</Label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Palabra o fragmento de definición..."
            className="studio-input"
            style={input}
          />
        </div>

        <div style={{ flex: "0 0 180px" }}>
          <Label>Tipo</Label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="studio-input"
            style={input}
          >
            <option value="all">Todos ({rows.length})</option>
            {[...typeCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([t, c]) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t] ?? t} ({c})
                </option>
              ))}
          </select>
        </div>

        <div style={{ flex: "0 0 auto" }}>
          <Label>&nbsp;</Label>
          <button
            onClick={() => setConflictOnly((v) => !v)}
            style={{
              height: 38,
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${conflictOnly ? "var(--primary)" : "var(--card-border)"}`,
              backgroundColor: conflictOnly ? "var(--primary)" : "transparent",
              color: conflictOnly ? "#fff" : "var(--muted)",
            }}
            title="Mostrar solo palabras con definiciones inconsistentes"
          >
            {conflictOnly ? `✓ Solo con conflictos (${conflictCount})` : `Solo con conflictos (${conflictCount})`}
          </button>
        </div>
      </div>

      {/* Summary line */}
      <div style={{ fontSize: 13, color: "var(--muted)", padding: "0 4px" }}>
        Mostrando <strong style={{ color: "var(--foreground)" }}>{filtered.length}</strong> de {rows.length} palabras únicas
        {" · "}
        {occurrencesTotal} ocurrencias totales en historias
        {conflictCount > 0 && (
          <>
            {" · "}
            <span style={{ color: "#dc2626" }}>{conflictCount} con definiciones inconsistentes</span>
          </>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          borderRadius: 10,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 110px 80px 1fr 40px",
            gap: 12,
            padding: "10px 16px",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            borderBottom: "1px solid var(--card-border)",
            backgroundColor: "var(--background)",
          }}
        >
          <div>Palabra</div>
          <div>Tipo</div>
          <div>Historias</div>
          <div>Definición (más usada)</div>
          <div></div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
            Sin resultados.
          </div>
        ) : (
          filtered.slice(0, 500).map((r) => {
            const isOpen = expandedKey === r.key;
            const topDef = r.definitions[0]?.definition || "-";
            return (
              <div key={r.key} style={{ borderBottom: "1px solid var(--card-border)" }}>
                <div
                  onClick={() => setExpandedKey(isOpen ? null : r.key)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "200px 110px 80px 1fr 40px",
                    gap: 12,
                    padding: "12px 16px",
                    alignItems: "center",
                    cursor: "pointer",
                    backgroundColor: isOpen ? "var(--background)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14, color: "var(--foreground)" }}>{r.word}</strong>
                    {r.hasConflict && (
                      <span
                        title={`${r.definitions.filter((d) => d.definition).length} definiciones distintas`}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          color: "#dc2626",
                          backgroundColor: "#fee2e2",
                        }}
                      >
                        ⚠ {r.definitions.filter((d) => d.definition).length}
                      </span>
                    )}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: "#fff",
                        backgroundColor: TYPE_COLOR[r.type] ?? TYPE_COLOR.unknown,
                      }}
                    >
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>×{r.occurrences}</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--foreground)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {topDef}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 14 }}>{isOpen ? "▾" : "▸"}</div>
                </div>

                {isOpen && (
                  <div style={{ padding: "8px 16px 20px 16px", backgroundColor: "var(--background)" }}>
                    {r.definitions.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid var(--card-border)",
                          backgroundColor: "var(--card-bg)",
                        }}
                      >
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ flex: 1, fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
                            {d.definition || <em style={{ color: "var(--muted)" }}>(sin definición)</em>}
                          </div>
                          {d.definition && (
                            <button
                              onClick={() => void applyCanonical(r.key, d.definition)}
                              disabled={pendingCanonical === r.key}
                              style={{
                                flex: "0 0 auto",
                                height: 30,
                                padding: "0 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 6,
                                cursor: pendingCanonical === r.key ? "wait" : "pointer",
                                border: "1px solid var(--primary)",
                                backgroundColor: "var(--primary)",
                                color: "#fff",
                                opacity: pendingCanonical === r.key ? 0.6 : 1,
                              }}
                              title={`Aplicar esta definición a las ${d.usages.length} historia(s) y a cualquier otra del journey con la palabra "${r.word}"`}
                            >
                              {pendingCanonical === r.key ? "Aplicando..." : "Hacer canónica"}
                            </button>
                          )}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                          {d.usages.length} historia(s):{" "}
                          {d.usages
                            .slice(0, 6)
                            .map((u) => u.storySlug)
                            .join(", ")}
                          {d.usages.length > 6 && ` …+${d.usages.length - 6}`}
                        </div>
                      </div>
                    ))}

                    {/* Custom canonical */}
                    <CustomCanonicalEditor
                      lemma={r.key}
                      onApply={(def) => void applyCanonical(r.key, def)}
                      disabled={pendingCanonical === r.key}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        {filtered.length > 500 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
            Mostrando primeras 500 filas. Usa los filtros para acotar.
          </div>
        )}
      </div>
    </div>
  );
}

function CustomCanonicalEditor({
  lemma,
  onApply,
  disabled,
}: {
  lemma: string;
  onApply: (def: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        borderRadius: 8,
        border: "1px dashed var(--card-border)",
        backgroundColor: "transparent",
      }}
    >
      <Label>Escribir una nueva definición canónica para &quot;{lemma}&quot;</Label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ej: To open; to make a door, window, or container accessible."
          className="studio-input"
          style={{ ...input, flex: 1 }}
        />
        <button
          onClick={() => trimmed && onApply(trimmed)}
          disabled={!trimmed || disabled}
          style={{
            flex: "0 0 auto",
            height: 38,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            cursor: !trimmed || disabled ? "not-allowed" : "pointer",
            border: "1px solid var(--primary)",
            backgroundColor: trimmed ? "var(--primary)" : "transparent",
            color: trimmed ? "#fff" : "var(--muted)",
            opacity: !trimmed || disabled ? 0.5 : 1,
          }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--muted)",
        marginBottom: 4,
      }}
    >
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
};
