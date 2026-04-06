"use client";

import { useCallback, useEffect, useState } from "react";

// ── Styles ──
const card: React.CSSProperties = {
  padding: 10, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 6,
};
const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#14b8a6",
};
const btnAdd: React.CSSProperties = {
  height: 22, padding: "0 8px", borderRadius: 4, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer",
};
const deleteX: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 9,
  color: "#ef4444", opacity: 0.5, lineHeight: 1,
};
const editPen: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12,
  opacity: 0.4, lineHeight: 1,
};
const inputSm: React.CSSProperties = {
  padding: "3px 8px", borderRadius: 4, border: "1px solid var(--card-border)",
  backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 13,
};
const chipItem: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 4,
  backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", fontSize: 13,
};
const variantChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 3,
  backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", fontSize: 11,
};

// ── Types ──
type Topic = { id: string; slug: string; label: string; isUniversal: boolean; defaultLevel: string | null; journeyTypes: { slug: string; label: string }[] };
type Variant = { id: string; code: string; label: string };
type Language = { id: string; code: string; label: string; variants: Variant[] };
type JourneyType = { id: string; slug: string; label: string };

// ── Confirm ──
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ ...card, maxWidth: 320, padding: 16, gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)" }}>{message}</p>
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
  const [journeyTypes, setJourneyTypes] = useState<JourneyType[]>([]);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newLang, setNewLang] = useState("");
  const [newLangRegion, setNewLangRegion] = useState("");
  const [addVariantId, setAddVariantId] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState("");
  const [newJourneyType, setNewJourneyType] = useState("");
  const [addTopicForJt, setAddTopicForJt] = useState<string | null>(null);
  const [newSpecializedTopic, setNewSpecializedTopic] = useState("");
  const [assignDropdownJt, setAssignDropdownJt] = useState<string | null>(null);
  const [levelEditId, setLevelEditId] = useState<string | null>(null);

  const LEVEL_OPTIONS = ["a1", "a2", "b1", "b2", "c1", "c2"];

  function LevelBadge({ topic }: { topic: Topic }) {
    const lvl = topic.defaultLevel?.toUpperCase() ?? "—";
    const isEditing = levelEditId === topic.id;

    if (isEditing) {
      return (
        <select autoFocus value={topic.defaultLevel ?? ""}
          onChange={(e) => { void api("/api/studio/topics", "PATCH", { id: topic.id, defaultLevel: e.target.value || null }); setLevelEditId(null); }}
          onBlur={() => setLevelEditId(null)}
          style={{ fontSize: 9, padding: "0 1px", borderRadius: 3, border: "1px solid #14b8a6", backgroundColor: "#0d1520", color: "#14b8a6", fontWeight: 700, width: 36 }}>
          {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      );
    }

    return (
      <span onClick={(e) => { e.stopPropagation(); setLevelEditId(topic.id); }}
        style={{ fontSize: 9, fontWeight: 700, color: "#14b8a6", backgroundColor: "rgba(20,184,166,0.12)", borderRadius: 3, padding: "0 4px", cursor: "pointer", lineHeight: "16px" }}
        title="Clic para cambiar nivel">
        {lvl}
      </span>
    );
  }

  const load = useCallback(async () => {
    const [t, l, jt] = await Promise.all([
      fetch("/api/studio/topics").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/languages").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/journey-types").then((r) => r.ok ? r.json() : []),
    ]);
    setTopics(t); setLanguages(l); setJourneyTypes(jt);
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

      {/* ══ IDIOMAS ══ */}
      <div style={card}>
        <p style={sectionLabel}>Idiomas</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {languages.map((lang) => (
            <div key={lang.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {editId === `l-${lang.id}` ? (
                <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/languages", "PATCH", { id: lang.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                  onBlur={() => { void api("/api/studio/languages", "PATCH", { id: lang.id, label: editValue }); cancelEdit(); }}
                  style={{ ...inputSm, fontSize: 13, width: 90, border: "1px solid #14b8a6" }} />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", minWidth: 80, cursor: "pointer" }} onClick={() => startEdit(`l-${lang.id}`, lang.label)}>{lang.label}</span>
              )}
              {lang.variants.map((v) => (
                <span key={v.id} style={variantChip}>
                  {editId === `v-${v.id}` ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/languages", "PATCH", { id: lang.id, renameVariant: { id: v.id, label: editValue } }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                      onBlur={() => { void api("/api/studio/languages", "PATCH", { id: lang.id, renameVariant: { id: v.id, label: editValue } }); cancelEdit(); }}
                      style={{ ...inputSm, fontSize: 10, padding: "1px 4px", width: 55, border: "1px solid #14b8a6" }} />
                  ) : (
                    <span onClick={() => startEdit(`v-${v.id}`, v.label)} style={{ cursor: "pointer", color: "var(--foreground)" }}>{v.label}</span>
                  )}
                  <button onClick={() => setConfirmAction({ message: `Eliminar región "${v.label}"?`, onConfirm: () => api("/api/studio/languages", "PATCH", { id: lang.id, removeVariantId: v.id }) })} style={{ ...deleteX, fontSize: 9 }}>✖</button>
                </span>
              ))}
              {addVariantId === lang.id ? (
                <input autoFocus value={newVariant} onChange={(e) => setNewVariant(e.target.value)} placeholder="Región"
                  onKeyDown={(e) => { if (e.key === "Enter" && newVariant.trim()) { void api("/api/studio/languages", "PATCH", { id: lang.id, addVariant: newVariant }); setAddVariantId(null); setNewVariant(""); } if (e.key === "Escape") setAddVariantId(null); }}
                  style={{ ...inputSm, fontSize: 10, padding: "2px 4px", width: 60 }} />
              ) : (
                <button onClick={() => { setAddVariantId(lang.id); setNewVariant(""); }} style={{ ...editPen, fontSize: 10, color: "#14b8a6" }}>+ región</button>
              )}
              <span style={{ flex: 1 }} />
              <button onClick={() => setConfirmAction({ message: `Eliminar "${lang.label}"?`, onConfirm: () => api("/api/studio/languages", "DELETE", { id: lang.id }) })} style={deleteX}>✖</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="Idioma"
            onKeyDown={(e) => { if (e.key === "Enter" && newLang.trim()) { void api("/api/studio/languages", "POST", { label: newLang, variants: newLangRegion.trim() ? [{ code: newLangRegion.toLowerCase(), label: newLangRegion }] : [] }); setNewLang(""); setNewLangRegion(""); } }}
            style={{ ...inputSm, flex: 1, fontSize: 12 }} />
          <input value={newLangRegion} onChange={(e) => setNewLangRegion(e.target.value)} placeholder="Región"
            style={{ ...inputSm, width: 80, fontSize: 12 }} />
          {newLang.trim() && <button onClick={() => { void api("/api/studio/languages", "POST", { label: newLang, variants: newLangRegion.trim() ? [{ code: newLangRegion.toLowerCase(), label: newLangRegion }] : [] }); setNewLang(""); setNewLangRegion(""); }} style={btnAdd}>+</button>}
        </div>
      </div>

      {/* ══ JOURNEYS ══ */}
      <div style={card}>
        <p style={sectionLabel}>Journeys</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {journeyTypes.map((jt) => (
            <span key={jt.id} style={chipItem}>
              {editId === `jt-${jt.id}` ? (
                <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/journey-types", "PATCH", { id: jt.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                  onBlur={() => { void api("/api/studio/journey-types", "PATCH", { id: jt.id, label: editValue }); cancelEdit(); }}
                  style={{ ...inputSm, fontSize: 12, padding: "2px 6px", width: 130, border: "1px solid #14b8a6" }} />
              ) : (
                <span onClick={() => startEdit(`jt-${jt.id}`, jt.label)} style={{ cursor: "pointer" }}>{jt.label}</span>
              )}
              <button onClick={() => setConfirmAction({ message: `Eliminar journey "${jt.label}"?`, onConfirm: () => api("/api/studio/journey-types", "DELETE", { id: jt.id }) })} style={deleteX}>✖</button>
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <input value={newJourneyType} onChange={(e) => setNewJourneyType(e.target.value)} placeholder="+ Nuevo journey"
              onKeyDown={(e) => { if (e.key === "Enter" && newJourneyType.trim()) { void api("/api/studio/journey-types", "POST", { label: newJourneyType }); setNewJourneyType(""); } }}
              style={{ ...inputSm, width: 130, fontSize: 12 }} />
            {newJourneyType.trim() && <button onClick={() => { void api("/api/studio/journey-types", "POST", { label: newJourneyType }); setNewJourneyType(""); }} style={btnAdd}>+</button>}
          </span>
        </div>
      </div>

      {/* ══ TEMAS — universal ══ */}
      <div style={card}>
        <p style={sectionLabel}>Temas universales</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>Disponibles en todos los journeys</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {topics.filter((t) => t.isUniversal).map((t) => (
            <span key={t.id} style={chipItem}>
              <LevelBadge topic={t} />
              {editId === `t-${t.id}` ? (
                <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { void api("/api/studio/topics", "PATCH", { id: t.id, label: editValue }); cancelEdit(); } if (e.key === "Escape") cancelEdit(); }}
                  onBlur={() => { void api("/api/studio/topics", "PATCH", { id: t.id, label: editValue }); cancelEdit(); }}
                  style={{ ...inputSm, fontSize: 12, padding: "2px 6px", width: 130, border: "1px solid #14b8a6" }} />
              ) : (
                <span onClick={() => startEdit(`t-${t.id}`, t.label)} style={{ cursor: "pointer" }}>{t.label}</span>
              )}
              <button onClick={() => setConfirmAction({ message: `Eliminar "${t.label}"?`, onConfirm: () => api("/api/studio/topics", "DELETE", { id: t.id }) })} style={deleteX}>✖</button>
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="+ Nuevo tema"
              onKeyDown={(e) => { if (e.key === "Enter" && newTopic.trim()) { void api("/api/studio/topics", "POST", { label: newTopic }); setNewTopic(""); } }}
              style={{ ...inputSm, width: 130, fontSize: 12 }} />
            {newTopic.trim() && <button onClick={() => { void api("/api/studio/topics", "POST", { label: newTopic }); setNewTopic(""); }} style={btnAdd}>+</button>}
          </span>
        </div>
      </div>

      {/* ══ TEMAS — specialized per journey type ══ */}
      <div style={card}>
        <p style={sectionLabel}>Temas especializados</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>Asignados a journeys específicos</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {journeyTypes.map((jt) => {
            const jtTopics = topics.filter((t) => !t.isUniversal && t.journeyTypes.some((j) => j.slug === jt.slug));
            // Topics that are specialized but NOT assigned to this journey type (for the assign dropdown)
            const unassignedSpecialized = topics.filter((t) => !t.isUniversal && !t.journeyTypes.some((j) => j.slug === jt.slug));
            return (
              <div key={jt.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#14b8a6", minWidth: 110, paddingTop: 2 }}>{jt.label}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1, alignItems: "center" }}>
                  {jtTopics.map((t) => (
                    <span key={t.id} style={{ ...chipItem, backgroundColor: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.15)" }}>
                      <LevelBadge topic={t} />
                      <span onClick={() => startEdit(`t-${t.id}`, t.label)} style={{ cursor: "pointer" }}>{t.label}</span>
                      <button onClick={() => void api("/api/studio/journey-types", "PATCH", { id: jt.id, unassignTopicId: t.id })} style={deleteX} title="Quitar de este journey">✖</button>
                    </span>
                  ))}
                  {jtTopics.length === 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Sin temas especializados</span>}

                  {/* Add new specialized topic */}
                  {addTopicForJt === jt.id ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <input autoFocus value={newSpecializedTopic} onChange={(e) => setNewSpecializedTopic(e.target.value)}
                        placeholder="Nuevo tema"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newSpecializedTopic.trim()) {
                            void api("/api/studio/journey-types", "PATCH", { id: jt.id, addTopicLabel: newSpecializedTopic });
                            setNewSpecializedTopic(""); setAddTopicForJt(null);
                          }
                          if (e.key === "Escape") { setAddTopicForJt(null); setNewSpecializedTopic(""); }
                        }}
                        style={{ ...inputSm, width: 140, fontSize: 12 }} />
                      <button onClick={() => { if (newSpecializedTopic.trim()) { void api("/api/studio/journey-types", "PATCH", { id: jt.id, addTopicLabel: newSpecializedTopic }); setNewSpecializedTopic(""); setAddTopicForJt(null); } }} style={btnAdd}>+</button>
                    </span>
                  ) : assignDropdownJt === jt.id ? (
                    <select autoFocus
                      onChange={(e) => { if (e.target.value) { void api("/api/studio/journey-types", "PATCH", { id: jt.id, assignTopicId: e.target.value }); } setAssignDropdownJt(null); }}
                      onBlur={() => setAssignDropdownJt(null)}
                      style={{ ...inputSm, fontSize: 12, padding: "2px 6px" }}>
                      <option value="">Seleccionar tema existente...</option>
                      {unassignedSpecialized.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ display: "inline-flex", gap: 3 }}>
                      <button onClick={() => { setAddTopicForJt(jt.id); setNewSpecializedTopic(""); }} style={{ ...editPen, fontSize: 10, color: "#14b8a6" }} title="Crear tema nuevo">+ nuevo</button>
                      {unassignedSpecialized.length > 0 && (
                        <button onClick={() => setAssignDropdownJt(jt.id)} style={{ ...editPen, fontSize: 10, color: "#14b8a6" }} title="Asignar tema existente">+ existente</button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
