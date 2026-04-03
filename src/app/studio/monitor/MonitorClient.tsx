"use client";

import { useState } from "react";

// ── Config ──

const LANGUAGES = [
  { code: "spanish", label: "Español", variants: [{ id: "latam", label: "Latam" }, { id: "spain", label: "España" }] },
  { code: "german", label: "Alemán", variants: [{ id: "germany", label: "Alemania" }, { id: "austria", label: "Austria" }] },
];

const ALL_TOPICS = [
  { slug: "community-celebrations", label: "Community & Celebrations" },
  { slug: "food-daily-life", label: "Food & Everyday Life" },
  { slug: "work-study", label: "Work & Study" },
  { slug: "travel-plans", label: "Travel & Plans" },
  { slug: "home-family", label: "Home & Family" },
  { slug: "health-wellbeing", label: "Health & Wellbeing" },
  { slug: "nature-adventure", label: "Nature & Adventure" },
  { slug: "traditions-daily-culture", label: "Traditions & Daily Culture" },
];

const LEVELS = ["a1", "a2", "b1", "b2"];

// ── Styles ──

const card: React.CSSProperties = {
  padding: 14, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 10,
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: "3px 10px", borderRadius: 5, border: `1px solid ${active ? "#14b8a6" : "var(--card-border)"}`,
  backgroundColor: active ? "rgba(20,184,166,0.15)" : "transparent",
  color: active ? "#14b8a6" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer",
});

const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#14b8a6",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" as const,
};

const btnPrimary = (disabled?: boolean): React.CSSProperties => ({
  height: 32, padding: "0 16px", borderRadius: 7, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});

const btnSecondary: React.CSSProperties = {
  height: 28, padding: "0 12px", borderRadius: 5, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", fontWeight: 600, fontSize: 11, cursor: "pointer",
};

// ── Types ──

type JourneySlot = {
  level: string;
  topic: string;
  topicLabel: string;
  status: "pending" | "generating" | "generated" | "published" | "error";
  story?: GeneratedStory;
  sanityId?: string;
  coverDone?: boolean;
  error?: string;
};

type GeneratedStory = {
  title: string; slug: string; text: string; synopsis: string;
  vocab: Array<{ word: string; translation?: string; type?: string; example?: string }>;
  wordCount: number; vocabCount: number;
};

// ── Component ──

export default function MonitorClient() {
  // Journey config
  const [journeyName, setJourneyName] = useState("German Generic");
  const [language, setLanguage] = useState("german");
  const [variant, setVariant] = useState("germany");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(["a1", "a2"]));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(["community-celebrations", "food-daily-life", "work-study", "travel-plans"]));
  const [storiesPerTopic, setStoriesPerTopic] = useState(1);

  // Journey slots
  const [slots, setSlots] = useState<JourneySlot[]>([]);
  const [journeyCreated, setJourneyCreated] = useState(false);

  // Expanded story
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const n = new Set(set);
    if (n.has(val)) n.delete(val); else n.add(val);
    return n;
  }

  // ── Create journey slots ──
  function createJourney() {
    const newSlots: JourneySlot[] = [];
    for (const level of LEVELS) {
      if (!selectedLevels.has(level)) continue;
      for (const topic of ALL_TOPICS) {
        if (!selectedTopics.has(topic.slug)) continue;
        for (let i = 0; i < storiesPerTopic; i++) {
          newSlots.push({ level, topic: topic.slug, topicLabel: topic.label, status: "pending" });
        }
      }
    }
    setSlots(newSlots);
    setJourneyCreated(true);
    setExpandedIdx(null);
  }

  // ── Generate one story ──
  async function generateSlot(idx: number) {
    const slot = slots[idx];
    setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "generating", error: undefined }; return n; });

    try {
      const res = await fetch("/api/studio/pipeline/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, variant, level: slot.level, topic: slot.topic }),
      });
      if (!res.ok) { const d = await res.json().catch(() => null); throw new Error(d?.error ?? `HTTP ${res.status}`); }
      const story = await res.json() as GeneratedStory;
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "generated", story }; return n; });
      setExpandedIdx(idx);
    } catch (err) {
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "error", error: err instanceof Error ? err.message : String(err) }; return n; });
    }
  }

  // ── Publish one story ──
  async function publishSlot(idx: number) {
    const slot = slots[idx];
    if (!slot.story) return;
    setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "generating" }; return n; });

    try {
      const res = await fetch("/api/studio/pipeline/publish-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: slot.story.title, slug: slot.story.slug, text: slot.story.text,
          synopsis: slot.story.synopsis, vocab: slot.story.vocab,
          language, variant, level: slot.level, topic: slot.topic,
        }),
      });
      if (!res.ok) throw new Error("Publish failed");
      const data = await res.json();
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "published", sanityId: data.sanityId }; return n; });
    } catch (err) {
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], status: "error", error: err instanceof Error ? err.message : String(err) }; return n; });
    }
  }

  // ── Generate cover ──
  async function generateCover(idx: number) {
    const slot = slots[idx];
    if (!slot.sanityId || !slot.story) return;

    try {
      const res = await fetch("/api/sanity/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: slot.sanityId, title: slot.story.title,
          synopsis: slot.story.synopsis || slot.story.text.slice(0, 500),
          language, region: variant, topic: slot.topic, level: slot.level, provider: "flux",
        }),
      });
      if (!res.ok) throw new Error("Cover failed");
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], coverDone: true }; return n; });
    } catch (err) {
      setSlots((s) => { const n = [...s]; n[idx] = { ...n[idx], error: err instanceof Error ? err.message : String(err) }; return n; });
    }
  }

  // ── Stats ──
  const published = slots.filter((s) => s.status === "published").length;
  const generated = slots.filter((s) => s.status === "generated" || s.status === "published").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ══ Journey Config ══ */}
      {!journeyCreated && (
        <div style={card}>
          <p style={sectionLabel}>Crear Journey</p>

          {/* Row 1: Name + Language + Variant */}
          <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>Nombre</span>
              <input value={journeyName} onChange={(e) => setJourneyName(e.target.value)} placeholder="Ej: German Generic"
                style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, width: 160 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>Idioma</span>
              <div style={{ display: "flex", gap: 3 }}>
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => { setLanguage(l.code); setVariant(l.variants[0].id); }} style={pill(language === l.code)}>{l.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>Variante</span>
              <div style={{ display: "flex", gap: 3 }}>
                {selectedLang.variants.map((v) => (
                  <button key={v.id} onClick={() => setVariant(v.id)} style={pill(variant === v.id)}>{v.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={fieldLabel}>Historias/tema</span>
              <input type="number" min={1} max={4} value={storiesPerTopic} onChange={(e) => setStoriesPerTopic(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, width: 50 }} />
            </div>
          </div>

          {/* Row 2: Levels */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={fieldLabel}>Niveles</span>
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setSelectedLevels(toggleSet(selectedLevels, l))} style={pill(selectedLevels.has(l))}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Row 3: Topics */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={fieldLabel}>Temas</span>
            {ALL_TOPICS.map((t) => (
              <button key={t.slug} onClick={() => setSelectedTopics(toggleSet(selectedTopics, t.slug))} style={pill(selectedTopics.has(t.slug))}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Create button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {selectedLevels.size} niveles x {selectedTopics.size} temas x {storiesPerTopic} = <strong style={{ color: "var(--foreground)" }}>{selectedLevels.size * selectedTopics.size * storiesPerTopic} historias</strong>
            </span>
            <button onClick={createJourney} disabled={selectedLevels.size === 0 || selectedTopics.size === 0}
              style={btnPrimary(selectedLevels.size === 0 || selectedTopics.size === 0)}>
              Crear journey
            </button>
          </div>
        </div>
      )}

      {/* ══ Story Queue ══ */}
      {journeyCreated && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={sectionLabel}>{journeyName}</p>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {published}/{slots.length} publicadas · {generated}/{slots.length} generadas
              </span>
            </div>
            <button onClick={() => { setJourneyCreated(false); setSlots([]); setExpandedIdx(null); }} style={btnSecondary}>
              Nuevo journey
            </button>
          </div>

          {/* Slot rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {slots.map((slot, idx) => {
              const isExpanded = expandedIdx === idx;
              const statusColor = slot.status === "published" ? "#22c55e" : slot.status === "generated" ? "#3b82f6" : slot.status === "generating" ? "#f59e0b" : slot.status === "error" ? "#ef4444" : "rgba(255,255,255,0.15)";
              const statusLabel = slot.status === "published" ? (slot.coverDone ? "Completa" : "Publicada") : slot.status === "generated" ? "Generada" : slot.status === "generating" ? "..." : slot.status === "error" ? "Error" : "Pendiente";

              return (
                <div key={idx}>
                  {/* Row */}
                  <div
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 5, cursor: "pointer",
                      backgroundColor: isExpanded ? "rgba(20,184,166,0.04)" : "transparent",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", width: 22 }}>{slot.level.toUpperCase()}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {slot.story?.title ?? slot.topicLabel}
                    </span>
                    {slot.story && <span style={{ fontSize: 10, color: "var(--muted)" }}>{slot.story.wordCount}w · {slot.story.vocabCount}v</span>}
                    <span style={{ fontSize: 9, color: statusColor, fontWeight: 600, width: 60, textAlign: "right" }}>{statusLabel}</span>

                    {/* Action button */}
                    {slot.status === "pending" && (
                      <button onClick={(e) => { e.stopPropagation(); void generateSlot(idx); }} style={btnPrimary()}>Generar</button>
                    )}
                    {slot.status === "generated" && (
                      <button onClick={(e) => { e.stopPropagation(); void publishSlot(idx); }} style={btnPrimary()}>Publicar</button>
                    )}
                    {slot.status === "published" && !slot.coverDone && (
                      <button onClick={(e) => { e.stopPropagation(); void generateCover(idx); }} style={btnSecondary}>Cover</button>
                    )}
                    {slot.status === "error" && (
                      <button onClick={(e) => { e.stopPropagation(); void generateSlot(idx); }} style={{ ...btnSecondary, borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}>Reintentar</button>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && slot.story && (
                    <div style={{ padding: "8px 8px 8px 36px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {/* Synopsis */}
                      {slot.story.synopsis && (
                        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontStyle: "italic", borderLeft: "2px solid var(--card-border)", paddingLeft: 8 }}>
                          {slot.story.synopsis}
                        </p>
                      )}
                      {/* Text */}
                      <div style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.6, maxHeight: 160, overflow: "auto", padding: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--card-border)", whiteSpace: "pre-wrap" }}>
                        {slot.story.text}
                      </div>
                      {/* Vocab */}
                      {slot.story.vocab.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {slot.story.vocab.map((v, i) => (
                            <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "var(--foreground)" }}>
                              <strong>{v.word}</strong>{v.translation && <span style={{ color: "var(--muted)" }}> — {v.translation}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Post-publish links */}
                      {slot.sanityId && (
                        <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                          <a href={`/studio/sanity/intent/edit/id=${encodeURIComponent(slot.sanityId)};type=standaloneStory`}
                            style={{ color: "#14b8a6", textDecoration: "none" }} target="_blank" rel="noopener">
                            Abrir en Sanity
                          </a>
                        </div>
                      )}
                      {slot.error && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{slot.error}</p>}
                    </div>
                  )}

                  {/* Error without expand */}
                  {!isExpanded && slot.error && (
                    <p style={{ margin: 0, padding: "2px 36px", fontSize: 10, color: "#ef4444" }}>{slot.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
