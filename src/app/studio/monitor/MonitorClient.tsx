"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Config ──

type LanguageItem = { code: string; label: string; variants: { id: string; code: string; label: string }[] };
type LevelItem = { code: string; label: string };

type TopicItem = { slug: string; label: string };

// ── Topic multi-select dropdown ──
function TopicDropdown({ available, selected, disabled, onToggle }: {
  available: TopicItem[];
  selected: Set<string>;
  disabled: Map<string, string>;
  onToggle: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedItems = available.filter((t) => selected.has(t.slug));

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      {/* Selected chips + trigger */}
      <div onClick={() => setOpen(!open)}
        style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap", padding: "2px 6px", borderRadius: 5, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", cursor: "pointer", minHeight: 22 }}>
        {selectedItems.map((t) => (
          <span key={t.slug} style={{ padding: "0 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, backgroundColor: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", color: "#14b8a6", whiteSpace: "nowrap" }}>
            {t.label}
            <span onClick={(e) => { e.stopPropagation(); onToggle(t.slug); }} style={{ marginLeft: 3, cursor: "pointer", opacity: 0.5, fontSize: 8 }}>x</span>
          </span>
        ))}
        {selectedItems.length === 0 && <span style={{ fontSize: 10, color: "var(--muted)" }}>Seleccionar temas...</span>}
        <span style={{ marginLeft: "auto", fontSize: 8, color: "var(--muted)", paddingLeft: 4 }}>▼</span>
      </div>

      {/* Dropdown popup */}
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, width: 260, padding: 4, borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "#0d1520", zIndex: 100, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {available.map((t) => {
            const taken = disabled.get(t.slug);
            const isSelected = selected.has(t.slug);
            if (taken) {
              return (
                <div key={t.slug} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", opacity: 0.3 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, border: "1.5px solid var(--card-border)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11 }}>{t.label}</span>
                  <span style={{ fontSize: 8, color: "var(--muted)" }}>({taken})</span>
                </div>
              );
            }
            return (
              <div key={t.slug}
                onClick={() => onToggle(t.slug)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  backgroundColor: isSelected ? "rgba(20,184,166,0.1)" : "transparent" }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, border: `1.5px solid ${isSelected ? "#14b8a6" : "var(--card-border)"}`, backgroundColor: isSelected ? "#14b8a6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", flexShrink: 0 }}>
                  {isSelected && "✓"}
                </span>
                <span style={{ fontSize: 11, color: "var(--foreground)" }}>{t.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  height: 28, padding: "0 14px", borderRadius: 6, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 11,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});
const btnSecondary: React.CSSProperties = {
  height: 24, padding: "0 10px", borderRadius: 5, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", fontWeight: 600, fontSize: 10, cursor: "pointer",
};
const chipStyle: React.CSSProperties = {
  padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
  backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.15)", color: "var(--foreground)",
};
const iconBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: 12, lineHeight: 1, opacity: 0.5,
};
const deleteBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 10, lineHeight: 1,
  color: "#ef4444", opacity: 0.6, borderRadius: 3,
};

// ── Types ──

type JourneySummary = {
  id: string; name: string; language: string; variant: string;
  levels: string[]; topics: string[]; storiesPerTopic: number;
  status: string; createdAt: string;
  stats: { total: number; generated: number; published: number; withCover: number };
};
type StoryRow = {
  id: string; slug: string | null; level: string; topic: string; slotIndex: number;
  status: string; title: string | null; wordCount: number | null;
  vocabCount: number | null; sanityId: string | null; coverDone: boolean;
  error: string | null;
};
type TopicGroup = { level: string; topic: string; label: string; stories: StoryRow[] };

// ── Confirm dialog ──
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div style={{ ...card, maxWidth: 360, padding: 20, gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)" }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnSecondary}>Cancelar</button>
          <button onClick={onConfirm} style={{ ...btnPrimary(), backgroundColor: "#ef4444" }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Component ──

export default function MonitorClient() {
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTopics, setAllTopics] = useState<TopicItem[]>([]);
  const [allLanguages, setAllLanguages] = useState<LanguageItem[]>([]);
  const [allLevels, setAllLevels] = useState<LevelItem[]>([]);
  const topicLabels: Record<string, string> = Object.fromEntries(allTopics.map((t) => [t.slug, t.label]));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [journeyFilter, setJourneyFilter] = useState<"all" | "pending" | "complete">("all");

  // Create form — language/variant set after data loads
  const [journeyName, setJourneyName] = useState("");
  const [language, setLanguage] = useState("");
  const [variant, setVariant] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(["a1", "a2"]));
  const [topicsByLevel, setTopicsByLevel] = useState<Record<string, Set<string>>>({
    a1: new Set(["community-celebrations", "food-daily-life"]),
    a2: new Set(["work-study", "travel-plans"]),
  });
  const [storiesPerTopic, setStoriesPerTopic] = useState(1);
  const [creating, setCreating] = useState(false);

  // Expanded journey (inline)
  const [expandedJourneyId, setExpandedJourneyId] = useState<string | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [busyStories, setBusyStories] = useState<Set<string>>(new Set());

  // Story detail panel
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);
  const [storyDetail, setStoryDetail] = useState<{ text?: string; synopsis?: string; vocab?: any[] } | null>(null);
  const [showText, setShowText] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confirm dialog & edit
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const selectedLang = allLanguages.find((l) => l.code === language) ?? allLanguages[0];

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const n = new Set(set);
    if (n.has(val)) n.delete(val); else n.add(val);
    return n;
  }

  function toggleLevel(level: string) {
    const n = new Set(selectedLevels);
    if (n.has(level)) {
      n.delete(level);
      const t = { ...topicsByLevel };
      delete t[level];
      setTopicsByLevel(t);
    } else {
      n.add(level);
      // Start with empty topics — user picks what's available
      setTopicsByLevel({ ...topicsByLevel, [level]: new Set() });
    }
    setSelectedLevels(n);
  }

  function toggleTopicForLevel(level: string, topic: string) {
    const current = topicsByLevel[level] ?? new Set();
    setTopicsByLevel({ ...topicsByLevel, [level]: toggleSet(current, topic) });
  }

  // Total stories count
  const totalStories = [...selectedLevels].reduce((sum, level) => {
    const topics = topicsByLevel[level];
    return sum + (topics?.size ?? 0) * storiesPerTopic;
  }, 0);

  const loadJourneys = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, tRes, lRes, lvRes] = await Promise.all([
        fetch("/api/studio/journeys"),
        fetch("/api/studio/topics"),
        fetch("/api/studio/languages"),
        fetch("/api/studio/levels"),
      ]);
      if (jRes.ok) setJourneys(await jRes.json());
      if (tRes.ok) setAllTopics(await tRes.json());
      if (lRes.ok) {
        const langs = await lRes.json();
        setAllLanguages(langs);
        // Set defaults if not yet set
        if (!language && langs.length > 0) {
          setLanguage(langs[0].code);
          setVariant(langs[0].variants?.[0]?.code || "");
        }
      }
      if (lvRes.ok) setAllLevels(await lvRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadJourneys(); }, [loadJourneys]);

  async function createJourney() {
    setCreating(true);
    try {
      const res = await fetch("/api/studio/journeys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: journeyName, language, variant,
          levels: [...selectedLevels],
          topics: [...new Set([...selectedLevels].flatMap((l) => [...(topicsByLevel[l] ?? [])]))],
          topicsByLevel: Object.fromEntries([...selectedLevels].map((l) => [l, [...(topicsByLevel[l] ?? [])]])),
          storiesPerTopic,
        }),
      });
      if (!res.ok) throw new Error("Error");
      await loadJourneys();
    } finally { setCreating(false); }
  }

  async function deleteJourney(id: string) {
    await fetch("/api/studio/journeys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: id }) });
    if (expandedJourneyId === id) { setExpandedJourneyId(null); setStories([]); }
    await loadJourneys();
  }

  async function renameJourney(id: string, name: string) {
    await fetch("/api/studio/journeys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: id, name }) });
    await loadJourneys();
    setEditingJourneyId(null);
  }

  async function deleteStory(storyId: string) {
    await fetch("/api/studio/journeys/stories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    if (expandedStoryId === storyId) { setExpandedStoryId(null); setStoryDetail(null); }
  }

  async function toggleJourney(j: JourneySummary) {
    if (expandedJourneyId === j.id) {
      setExpandedJourneyId(null); setStories([]); setExpandedTopic(null);
      setExpandedStoryId(null); setStoryDetail(null);
      return;
    }
    setExpandedJourneyId(j.id); setExpandedTopic(null);
    setExpandedStoryId(null); setStoryDetail(null);
    const res = await fetch(`/api/studio/journeys/stories?journeyId=${j.id}`);
    if (res.ok) setStories(await res.json());
  }

  function getTopicGroups(): TopicGroup[] {
    const map = new Map<string, TopicGroup>();
    stories.forEach((s) => {
      const key = `${s.level}:${s.topic}`;
      if (!map.has(key)) map.set(key, { level: s.level, topic: s.topic, label: topicLabels[s.topic] || s.topic, stories: [] });
      map.get(key)!.stories.push(s);
    });
    return Array.from(map.values());
  }

  async function generateStory(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      setStories((prev) => prev.map((s) => s.id === storyId
        ? { ...s, status: res.ok ? "generated" : s.status, title: data.title ?? s.title, wordCount: data.wordCount ?? s.wordCount, vocabCount: data.vocabCount ?? s.vocabCount, error: res.ok ? null : data.error }
        : s));
    } catch (err) {
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, error: String(err) } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function publishStory(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      setStories((prev) => prev.map((s) => s.id === storyId
        ? { ...s, status: res.ok ? "published" : s.status, error: res.ok ? null : data.error }
        : s));
    } catch (err) {
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, error: String(err) } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function generateCover(storyId: string) {
    const story = stories.find((s) => s.id === storyId);
    const j = journeys.find((j) => j.id === expandedJourneyId);
    if (!story?.sanityId || !j) return;
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/sanity/generate-cover", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: story.sanityId, title: story.title || "", synopsis: "", language: j.language, region: j.variant, topic: story.topic, level: story.level, provider: "flux" }) });
      if (res.ok) setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, coverDone: true } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  // Add a new story slot to a topic via API
  async function addStoryToTopic(journeyId: string, level: string, topic: string) {
    const existing = stories.filter((s) => s.level === level && s.topic === topic);
    const nextSlot = existing.length > 0 ? Math.max(...existing.map((s) => s.slotIndex)) + 1 : 0;
    try {
      const res = await fetch("/api/studio/journeys/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId, level, topic, slotIndex: nextSlot }),
      });
      if (res.ok) {
        const newStory = await res.json();
        setStories((prev) => [...prev, newStory]);
      }
    } catch { /* ignore */ }
  }

  // Generate all pending stories in a topic sequentially
  async function generateAllInTopic(group: TopicGroup) {
    const pending = group.stories.filter((s) => s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review");
    for (const s of pending) {
      await generateStory(s.id);
    }
  }

  function dotColor(status: string, coverDone?: boolean) {
    if (status === "published" && coverDone) return "#22c55e";
    if (status === "published") return "#86efac";
    if (status === "generated" || status === "qa_pass" || status === "approved") return "#3b82f6";
    if (status === "draft") return "rgba(255,255,255,0.15)";
    return "#ef4444";
  }

  function storyAction(s: StoryRow) {
    const busy = busyStories.has(s.id);
    if (busy) return { label: "...", disabled: true, onClick: () => {} };
    if (s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review")
      return { label: "Generar historia", disabled: false, onClick: () => generateStory(s.id) };
    if (s.status === "generated" || s.status === "qa_pass" || s.status === "approved")
      return { label: "Publicar", disabled: false, onClick: () => publishStory(s.id) };
    if (s.status === "published" && !s.coverDone)
      return { label: "Cover", disabled: false, onClick: () => generateCover(s.id) };
    return null;
  }

  async function toggleStoryDetail(storyId: string) {
    if (expandedStoryId === storyId) {
      setExpandedStoryId(null); setStoryDetail(null); setShowText(false); setShowVocab(false);
      return;
    }
    setExpandedStoryId(storyId); setStoryDetail(null); setShowText(false); setShowVocab(false);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/studio/journeys/story?id=${storyId}`);
      if (res.ok) setStoryDetail(await res.json());
    } finally { setLoadingDetail(false); }
  }

  async function updateStoryField(storyId: string, field: "title" | "synopsis", value: string) {
    try {
      await fetch("/api/studio/journeys/story", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId, [field]: value }),
      });
      // Update local state
      if (field === "title") {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, title: value } : s));
      }
      if (storyDetail) {
        setStoryDetail({ ...storyDetail, [field]: value });
      }
    } catch { /* ignore */ }
  }

  // Renders the inline story editor panel
  function renderStoryEditor(s: StoryRow) {
    if (expandedStoryId !== s.id) return null;
    const statusText = s.status === "published" ? (s.coverDone ? "Completa" : "En Sanity") :
      s.status === "generated" ? "Generada" : s.status === "draft" ? "Pendiente" : s.status;

    return (
      <div style={{ padding: "10px 8px 10px 28px", display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        {loadingDetail && <span style={{ fontSize: 10, color: "var(--muted)" }}>Cargando...</span>}

        {storyDetail && (
          <>
            {/* Editable title */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Titulo</span>
              <input
                value={storyDetail.title ?? ""}
                onChange={(e) => setStoryDetail({ ...storyDetail, title: e.target.value })}
                onBlur={(e) => updateStoryField(s.id, "title", e.target.value)}
                style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, width: "100%" }}
              />
            </div>

            {/* Editable synopsis */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Synopsis</span>
              <textarea
                value={storyDetail.synopsis ?? ""}
                onChange={(e) => setStoryDetail({ ...storyDetail, synopsis: e.target.value })}
                onBlur={(e) => updateStoryField(s.id, "synopsis", e.target.value)}
                rows={2}
                style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 11, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            {/* Stats + slug + link row */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...chipStyle, backgroundColor: dotColor(s.status, s.coverDone) + "22", borderColor: dotColor(s.status, s.coverDone) + "44", color: dotColor(s.status, s.coverDone) }}>{statusText}</span>
              {s.wordCount != null && <span style={chipStyle}>{s.wordCount} palabras</span>}
              {s.vocabCount != null && <span style={chipStyle}>{s.vocabCount} vocabulario</span>}
              {s.slug && <span style={{ ...chipStyle, fontFamily: "monospace", fontSize: 8 }}>{s.slug}</span>}
              {s.slug && s.status === "published" && (
                <a href={`/stories/${s.slug}`} target="_blank" rel="noopener"
                  style={{ fontSize: 10, color: "#14b8a6", textDecoration: "none", fontWeight: 600 }}>
                  Abrir historia ↗
                </a>
              )}
            </div>

            {/* Action buttons row */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setShowText(!showText)}
                style={{ ...btnSecondary, ...(showText ? { borderColor: "#14b8a6", color: "#14b8a6" } : {}) }}>
                {showText ? "Ocultar texto" : "Ver texto"}
              </button>
              <button onClick={() => setShowVocab(!showVocab)}
                style={{ ...btnSecondary, ...(showVocab ? { borderColor: "#14b8a6", color: "#14b8a6" } : {}) }}>
                {showVocab ? "Ocultar vocabulario" : `Ver vocabulario (${s.vocabCount || 0})`}
              </button>
              {s.sanityId && (
                <a href={`/studio/sanity/intent/edit/id=${encodeURIComponent(s.sanityId)};type=standaloneStory`}
                  style={{ ...btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center" }} target="_blank" rel="noopener">
                  Abrir en Sanity
                </a>
              )}
            </div>

            {/* Collapsible text */}
            {showText && storyDetail.text && (
              <div style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.6, maxHeight: 200, overflow: "auto", padding: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--card-border)", whiteSpace: "pre-wrap" }}>
                {storyDetail.text}
              </div>
            )}

            {/* Collapsible vocab */}
            {showVocab && storyDetail.vocab && storyDetail.vocab.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {storyDetail.vocab.map((v: any, i: number) => (
                  <span key={i} style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "var(--foreground)" }}>
                    <strong>{v.word}</strong>{v.translation && <span style={{ color: "var(--muted)" }}> — {v.translation}</span>}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {s.error && <p style={{ margin: 0, fontSize: 10, color: "#ef4444" }}>{s.error}</p>}
      </div>
    );
  }

  const topicGroups = getTopicGroups();

  // ═══════════════════ RENDER ═══════════════════

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {confirmAction && (
        <ConfirmDialog message={confirmAction.message}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)} />
      )}

      {/* ══ Create form ══ */}
      <div style={{ ...card, gap: 8, padding: "12px 14px", ...(allLanguages.length === 0 ? { opacity: 0.5, pointerEvents: "none" } : {}) }}>
        {/* Row 1: Name (large) + count + create button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input value={journeyName} onChange={(e) => setJourneyName(e.target.value)} placeholder="Nombre del journey"
            style={{ padding: "4px 0", border: "none", borderBottom: "1px solid var(--card-border)", backgroundColor: "transparent", color: "var(--foreground)", fontSize: 16, fontWeight: 700, flex: 1, outline: "none" }} />
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
            {totalStories} {totalStories === 1 ? "historia" : "historias"}
          </span>
          <button onClick={() => void createJourney()} disabled={creating || totalStories === 0 || !journeyName.trim()}
            style={btnPrimary(creating || totalStories === 0 || !journeyName.trim())}>
            {creating ? "Creando..." : "Crear journey"}
          </button>
        </div>

        {/* Row 2: Language + Region + Levels + stories/topic */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={language}
            onChange={(e) => { setLanguage(e.target.value); const l = allLanguages.find((x) => x.code === e.target.value); if (l?.variants?.[0]) setVariant(l.variants[0].code); }}
            style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--foreground)", fontSize: 11, height: 24 }}>
            {allLanguages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {selectedLang?.variants?.length > 0 && (
            <select value={variant} onChange={(e) => setVariant(e.target.value)}
              style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--foreground)", fontSize: 11, height: 24 }}>
              {selectedLang.variants.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
            </select>
          )}
          <span style={{ width: 1, height: 14, backgroundColor: "var(--card-border)" }} />
          {allLevels.map((l) => <button key={l.code} onClick={() => toggleLevel(l.code)} style={{ ...pill(selectedLevels.has(l.code)), padding: "1px 7px", fontSize: 10 }}>{l.code.toUpperCase()}</button>)}
          <span style={{ width: 1, height: 14, backgroundColor: "var(--card-border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" min={1} max={10} value={storiesPerTopic} onChange={(e) => setStoriesPerTopic(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 11, width: 32, textAlign: "center" }} />
            <span style={{ fontSize: 10, color: "var(--muted)" }}>historia/tema</span>
          </div>
        </div>

        {/* Row 3+: Topics PER LEVEL with dropdown (exclusive across levels) */}
        {[...selectedLevels].sort().map((level) => {
          const levelTopics = topicsByLevel[level] ?? new Set();
          const takenByOther = new Map<string, string>();
          for (const [otherLevel, otherTopics] of Object.entries(topicsByLevel)) {
            if (otherLevel === level || !selectedLevels.has(otherLevel)) continue;
            for (const t of otherTopics) takenByOther.set(t, otherLevel.toUpperCase());
          }
          return (
            <div key={level} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#14b8a6", width: 22, flexShrink: 0 }}>{level.toUpperCase()}</span>
              <TopicDropdown
                available={allTopics}
                selected={levelTopics}
                disabled={takenByOther}
                onToggle={(slug) => toggleTopicForLevel(level, slug)}
              />
            </div>
          );
        })}
      </div>

      {/* ══ Journeys list (inline expandable) ══ */}
      {journeys.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={sectionLabel}>Journeys</p>
          <div style={{ display: "flex", gap: 3 }}>
            {(["all", "pending", "complete"] as const).map((f) => (
              <button key={f} onClick={() => setJourneyFilter(f)}
                style={{ ...pill(journeyFilter === f), padding: "2px 8px", fontSize: 9 }}>
                {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : "Completos"}
              </button>
            ))}
          </div>
        </div>
      )}
      {loading && <p style={{ fontSize: 11, color: "var(--muted)" }}>Cargando...</p>}

      {journeys.filter((j) => {
        if (journeyFilter === "pending") return j.stats.published < j.stats.total;
        if (journeyFilter === "complete") return j.stats.total > 0 && j.stats.published === j.stats.total;
        return true;
      }).map((j) => {
        const pct = j.stats.total > 0 ? Math.round((j.stats.published / j.stats.total) * 100) : 0;
        const lang = allLanguages.find((l) => l.code === j.language);
        const isEditing = editingJourneyId === j.id;
        const isExpanded = expandedJourneyId === j.id;

        return (
          <div key={j.id} style={{ ...card, gap: 0, padding: 0, overflow: "hidden" }}>
            {/* Journey header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
              onClick={() => void toggleJourney(j)}>
              <span style={{ fontSize: 10, color: "var(--muted)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
              {isEditing ? (
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === "Enter") void renameJourney(j.id, editName); if (e.key === "Escape") setEditingJourneyId(null); }}
                  onBlur={() => void renameJourney(j.id, editName)}
                  style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #14b8a6", backgroundColor: "transparent", color: "var(--foreground)", fontSize: 13, fontWeight: 700, width: 180 }} />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{j.name}</span>
              )}
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {lang?.label || j.language} · {j.levels.map((l) => l.toUpperCase()).join(", ")} · {j.topics.length} temas
              </span>
              <span style={{ flex: 1 }} />
              <span style={chipStyle}>{j.stats.published}/{j.stats.total} publicadas</span>

              {/* Progress bar mini */}
              <div style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, backgroundColor: "#14b8a6", borderRadius: 2 }} />
              </div>

              <button onClick={(e) => { e.stopPropagation(); setEditingJourneyId(j.id); setEditName(j.name); }} style={iconBtn} title="Renombrar">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ message: `Eliminar "${j.name}" y todas sus historias?`, onConfirm: () => deleteJourney(j.id) }); }}
                style={deleteBtn} title="Eliminar">&#x2716;</button>
            </div>

            {/* Expanded: grouped by LEVEL, then topics within */}
            {isExpanded && (() => {
              // Group by level
              const levels = [...new Set(stories.map((s) => s.level))].sort();
              return (
                <div style={{ borderTop: "1px solid var(--card-border)", padding: "4px 12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {levels.map((level) => {
                    const levelTopics = topicGroups.filter((g) => g.level === level);
                    const levelGen = levelTopics.reduce((a, g) => a + g.stories.filter((s) => ["generated", "qa_pass", "approved", "published"].includes(s.status)).length, 0);
                    const levelTotal = levelTopics.reduce((a, g) => a + g.stories.length, 0);

                    return (
                      <div key={level}>
                        {/* Level header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px 2px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#14b8a6", letterSpacing: "0.05em" }}>{level.toUpperCase()}</span>
                          <span style={{ flex: 1, height: 1, backgroundColor: "rgba(20,184,166,0.15)" }} />
                          <span style={{ ...chipStyle, fontSize: 8 }}>{levelGen}/{levelTotal}</span>
                        </div>

                        {/* Topics in this level */}
                        {levelTopics.map((group) => {
                          const key = `${group.level}:${group.topic}`;
                          const isTopicOpen = expandedTopic === key;
                          const gen = group.stories.filter((s) => ["generated", "qa_pass", "approved", "published"].includes(s.status)).length;
                          const pendingCount = group.stories.filter((s) => s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review").length;
                          const topicBusy = group.stories.some((s) => busyStories.has(s.id));

                          return (
                            <div key={key}>
                              {/* Topic row */}
                              <div onClick={() => { setExpandedTopic(isTopicOpen ? null : key); setExpandedStoryId(null); setStoryDetail(null); }}
                                style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 4px 16px", borderRadius: 5, cursor: "pointer",
                                  backgroundColor: isTopicOpen ? "rgba(20,184,166,0.04)" : "transparent" }}>
                                <span style={{ fontSize: 12, color: "var(--foreground)", fontWeight: 500 }}>{group.label}</span>
                                <div style={{ display: "flex", gap: 3, marginLeft: 4 }}>
                                  {group.stories.map((s) => (
                                    <span key={s.id} style={{ width: 8, height: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      {busyStories.has(s.id) ? (
                                        <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                                      ) : (
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dotColor(s.status, s.coverDone) }} />
                                      )}
                                    </span>
                                  ))}
                                </div>
                                <span style={{ flex: 1 }} />
                                {pendingCount > 0 && (
                                  <button onClick={(e) => { e.stopPropagation(); void generateAllInTopic(group); }}
                                    disabled={topicBusy}
                                    style={{ ...btnPrimary(topicBusy), fontSize: 9, height: 22, padding: "0 8px" }}>
                                    {topicBusy ? "Generando..." : `Generar todas (${pendingCount})`}
                                  </button>
                                )}
                                <span style={{ ...chipStyle, fontSize: 9 }}>{gen}/{group.stories.length}</span>
                                <span style={{ fontSize: 10, color: "var(--muted)", transform: isTopicOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
                              </div>

                              {/* Stories inside topic */}
                              {isTopicOpen && (
                                <div style={{ paddingLeft: 36, display: "flex", flexDirection: "column", gap: 1 }}>
                                  {group.stories.map((s) => {
                                    const action = storyAction(s);
                                    const isDetailOpen = expandedStoryId === s.id;
                                    return (
                                      <div key={s.id}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                                          <span style={{ width: 8, height: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {busyStories.has(s.id) ? (
                                              <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid rgba(245,158,11,0.3)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                                            ) : (
                                              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: dotColor(s.status, s.coverDone) }} />
                                            )}
                                          </span>
                                          <span onClick={() => s.title ? void toggleStoryDetail(s.id) : undefined}
                                            style={{ flex: 1, color: isDetailOpen ? "#14b8a6" : "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: s.title ? "pointer" : "default" }}>
                                            {s.title || `Historia ${s.slotIndex + 1}`}
                                          </span>
                                          {s.wordCount != null && <span style={chipStyle}>{s.wordCount}w</span>}
                                          {s.vocabCount != null && <span style={chipStyle}>{s.vocabCount}v</span>}
                                          {action && (
                                            <button onClick={() => action.onClick()} disabled={action.disabled}
                                              style={{ ...btnPrimary(action.disabled), fontSize: 10, height: 24, padding: "0 10px",
                                                ...(s.status === "generated" ? { backgroundColor: "#3b82f6" } : {}),
                                                ...(s.status === "published" && !s.coverDone ? { backgroundColor: "transparent", border: "1px solid var(--card-border)", color: "var(--foreground)" } : {}),
                                              }}>{action.label}</button>
                                          )}
                                          {s.status === "published" && s.coverDone && <span style={{ fontSize: 9, color: "#22c55e" }}>✓</span>}
                                          <button onClick={() => setConfirmAction({ message: `Eliminar "${s.title || "Historia " + (s.slotIndex + 1)}"?`, onConfirm: () => deleteStory(s.id) })}
                                            style={deleteBtn} title="Eliminar historia">&#x2716;</button>
                                        </div>
                                        {renderStoryEditor(s)}
                                      </div>
                                    );
                                  })}
                                  <button onClick={() => void addStoryToTopic(j.id, group.level, group.topic)}
                                    style={{ ...btnSecondary, alignSelf: "flex-start", marginTop: 4, marginLeft: 8, fontSize: 10, color: "#14b8a6", borderColor: "rgba(20,184,166,0.3)" }}>
                                    + Agregar historia
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
