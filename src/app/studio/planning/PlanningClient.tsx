"use client";

import { useCallback, useEffect, useState } from "react";

// ── Styles ──
const card: React.CSSProperties = {
  padding: 10, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 6,
};
const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#14b8a6",
};
const btnAdd: React.CSSProperties = {
  height: 22, padding: "0 8px", borderRadius: 4, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 9, cursor: "pointer",
};
const deleteX: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 9,
  color: "#ef4444", opacity: 0.5, lineHeight: 1,
};
const editPen: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 10,
  opacity: 0.4, lineHeight: 1,
};
const inputSm: React.CSSProperties = {
  padding: "2px 6px", borderRadius: 4, border: "1px solid var(--card-border)",
  backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 11,
};
const chipItem: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4,
  backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", fontSize: 11,
};
const variantChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 2, padding: "1px 5px", borderRadius: 3,
  backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", fontSize: 9,
};

// ── Types ──
type Topic = { id: string; slug: string; label: string };
type Variant = { id: string; code: string; label: string };
type Language = { id: string; code: string; label: string; variants: Variant[] };
type Level = { id: string; code: string; label: string };

// ── Confirm ──
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ ...card, maxWidth: 320, padding: 16, gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)" }}>{message}</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...btnAdd, backgroundColor: "transparent", border: "1px solid var(--card-border)", color: "var(--foreground)" }}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...btnAdd, backgroundColor: "#ef4444" }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

export default function PlanningClient() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newLang, setNewLang] = useState("");
  const [newLangRegion, setNewLangRegion] = useState("");
  const [newLevelCode, setNewLevelCode] = useState("");
  const [newLevelLabel, setNewLevelLabel] = useState("");
  const [addVariantId, setAddVariantId] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState("");

  const load = useCallback(async () => {
    const [t, l, v] = await Promise.all([
      fetch("/api/studio/topics").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/languages").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/levels").then((r) => r.ok ? r.json() : []),
    ]);
    setTopics(t); setLanguages(l); setLevels(v);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function api(url: string, method: string, body: any) {
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await load();
  }

  function startEdit(id: string, val: string) { setEditId(id); setEditValue(val); }
  function cancelEdit() { setEditId(null); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {confirmAction && <ConfirmDialog message={confirmAction.message} onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}

      {/* ══ TEMAS — horizontal wrapping chips ══ */}
      <div style={card}>
        <p style={sectionLabel}>Temas</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {topics.map((t) => (
            <span key={t.id} style={chipItem}>
              {editId === `t-${t.id}` ? (
                <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/topics", "PATCH", { id: t.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                  onBlur={() => { void api("/api/studio/topics", "PATCH", { id: t.id, label: editValue }); cancelEdit(); }}
                  style={{ ...inputSm, fontSize: 10, padding: "1px 4px", width: 120, border: "1px solid #14b8a6" }} />
              ) : (
                <span onClick={() => startEdit(`t-${t.id}`, t.label)} style={{ cursor: "pointer" }}>{t.label}</span>
              )}
              <button onClick={() => setConfirmAction({ message: `Eliminar "${t.label}"?`, onConfirm: () => api("/api/studio/topics", "DELETE", { id: t.id }) })} style={deleteX}>✖</button>
            </span>
          ))}
          {/* Inline add */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="+ Nuevo tema"
              onKeyDown={(e) => { if (e.key === "Enter" && newTopic.trim()) { void api("/api/studio/topics", "POST", { label: newTopic }); setNewTopic(""); } }}
              style={{ ...inputSm, width: 120, fontSize: 10 }} />
            {newTopic.trim() && <button onClick={() => { void api("/api/studio/topics", "POST", { label: newTopic }); setNewTopic(""); }} style={btnAdd}>+</button>}
          </span>
        </div>
      </div>

      {/* ══ IDIOMAS + NIVELES side by side ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

        {/* Idiomas */}
        <div style={card}>
          <p style={sectionLabel}>Idiomas</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {languages.map((lang) => (
              <div key={lang.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {editId === `l-${lang.id}` ? (
                  <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/languages", "PATCH", { id: lang.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                    onBlur={() => { void api("/api/studio/languages", "PATCH", { id: lang.id, label: editValue }); cancelEdit(); }}
                    style={{ ...inputSm, fontSize: 11, width: 80, border: "1px solid #14b8a6" }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", minWidth: 70, cursor: "pointer" }} onClick={() => startEdit(`l-${lang.id}`, lang.label)}>{lang.label}</span>
                )}
                {/* Variant chips */}
                {lang.variants.map((v) => (
                  <span key={v.id} style={variantChip}>
                    {editId === `v-${v.id}` ? (
                      <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/languages", "PATCH", { id: lang.id, renameVariant: { id: v.id, label: editValue } }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                        onBlur={() => { void api("/api/studio/languages", "PATCH", { id: lang.id, renameVariant: { id: v.id, label: editValue } }); cancelEdit(); }}
                        style={{ ...inputSm, fontSize: 8, padding: "0 3px", width: 50, border: "1px solid #14b8a6" }} />
                    ) : (
                      <span onClick={() => startEdit(`v-${v.id}`, v.label)} style={{ cursor: "pointer", color: "var(--foreground)" }}>{v.label}</span>
                    )}
                    <button onClick={() => setConfirmAction({ message: `Eliminar región "${v.label}"?`, onConfirm: () => api("/api/studio/languages", "PATCH", { id: lang.id, removeVariantId: v.id }) })} style={{ ...deleteX, fontSize: 7 }}>✖</button>
                  </span>
                ))}
                {addVariantId === lang.id ? (
                  <input autoFocus value={newVariant} onChange={(e) => setNewVariant(e.target.value)} placeholder="Región"
                    onKeyDown={(e) => { if (e.key === "Enter" && newVariant.trim()) { void api("/api/studio/languages", "PATCH", { id: lang.id, addVariant: newVariant }); setAddVariantId(null); setNewVariant(""); } if (e.key === "Escape") setAddVariantId(null); }}
                    style={{ ...inputSm, fontSize: 8, padding: "1px 3px", width: 55 }} />
                ) : (
                  <button onClick={() => { setAddVariantId(lang.id); setNewVariant(""); }} style={{ ...editPen, fontSize: 8, color: "#14b8a6" }}>+ región</button>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={() => setConfirmAction({ message: `Eliminar "${lang.label}"?`, onConfirm: () => api("/api/studio/languages", "DELETE", { id: lang.id }) })} style={deleteX}>✖</button>
              </div>
            ))}
          </div>
          {/* Add language */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="Idioma"
              onKeyDown={(e) => { if (e.key === "Enter" && newLang.trim()) { void api("/api/studio/languages", "POST", { label: newLang, variants: newLangRegion.trim() ? [{ code: newLangRegion.toLowerCase(), label: newLangRegion }] : [] }); setNewLang(""); setNewLangRegion(""); } }}
              style={{ ...inputSm, flex: 1, fontSize: 10 }} />
            <input value={newLangRegion} onChange={(e) => setNewLangRegion(e.target.value)} placeholder="Región"
              style={{ ...inputSm, width: 70, fontSize: 10 }} />
            {newLang.trim() && <button onClick={() => { void api("/api/studio/languages", "POST", { label: newLang, variants: newLangRegion.trim() ? [{ code: newLangRegion.toLowerCase(), label: newLangRegion }] : [] }); setNewLang(""); setNewLangRegion(""); }} style={btnAdd}>+</button>}
          </div>
        </div>

        {/* Niveles */}
        <div style={card}>
          <p style={sectionLabel}>Niveles</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {levels.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6", width: 24 }}>{l.code.toUpperCase()}</span>
                {editId === `lv-${l.id}` ? (
                  <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/levels", "PATCH", { id: l.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                    onBlur={() => { void api("/api/studio/levels", "PATCH", { id: l.id, label: editValue }); cancelEdit(); }}
                    style={{ ...inputSm, flex: 1, fontSize: 10, border: "1px solid #14b8a6" }} />
                ) : (
                  <span style={{ flex: 1, fontSize: 11, color: "var(--foreground)", cursor: "pointer" }} onClick={() => startEdit(`lv-${l.id}`, l.label)}>{l.label}</span>
                )}
                <button onClick={() => setConfirmAction({ message: `Eliminar nivel "${l.code.toUpperCase()}"?`, onConfirm: () => api("/api/studio/levels", "DELETE", { id: l.id }) })} style={deleteX}>✖</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input value={newLevelCode} onChange={(e) => setNewLevelCode(e.target.value)} placeholder="Código"
              style={{ ...inputSm, width: 50, fontSize: 10 }} />
            <input value={newLevelLabel} onChange={(e) => setNewLevelLabel(e.target.value)} placeholder="Descripción"
              onKeyDown={(e) => { if (e.key === "Enter" && newLevelCode.trim() && newLevelLabel.trim()) { void api("/api/studio/levels", "POST", { code: newLevelCode, label: newLevelLabel }); setNewLevelCode(""); setNewLevelLabel(""); } }}
              style={{ ...inputSm, flex: 1, fontSize: 10 }} />
            {newLevelCode.trim() && newLevelLabel.trim() && <button onClick={() => { void api("/api/studio/levels", "POST", { code: newLevelCode, label: newLevelLabel }); setNewLevelCode(""); setNewLevelLabel(""); }} style={btnAdd}>+</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
