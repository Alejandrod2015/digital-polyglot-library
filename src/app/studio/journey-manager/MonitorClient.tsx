"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import PracticeSetEditor from "@/components/studio/PracticeSetEditor";
import MiniPlayer from "@/components/studio/MiniPlayer";

// ── Inline SVG icons (no emoji) ──
type IconName =
  | "chevron"
  | "edit"
  | "x"
  | "plus"
  | "minus"
  | "bolt"
  | "refresh"
  | "check"
  | "play"
  | "pause"
  | "external"
  | "trash";

function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "chevron":
      return (<svg {...common}><polyline points="6 4 10 8 6 12" /></svg>);
    case "edit":
      return (<svg {...common}><path d="M10.5 2.5l3 3-7.5 7.5H3v-3z" /></svg>);
    case "x":
      return (<svg {...common}><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>);
    case "plus":
      return (<svg {...common}><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>);
    case "minus":
      return (<svg {...common}><line x1="3" y1="8" x2="13" y2="8" /></svg>);
    case "bolt":
      return (<svg {...common}><polygon points="9 1.5 3.5 9 7.5 9 6.5 14.5 12.5 7 8.5 7 9 1.5" /></svg>);
    case "refresh":
      return (<svg {...common}><path d="M2.5 7.5a5.5 5.5 0 0 1 9.5-3.2M13.5 8.5a5.5 5.5 0 0 1-9.5 3.2" /><polyline points="11.5 1.5 12 4.5 9 4.8" /><polyline points="4.5 14.5 4 11.5 7 11.2" /></svg>);
    case "check":
      return (<svg {...common}><polyline points="3 8.5 6.5 12 13 4.5" /></svg>);
    case "play":
      return (<svg {...common} fill="currentColor" stroke="none"><polygon points="4 3 13 8 4 13" /></svg>);
    case "pause":
      return (<svg {...common} fill="currentColor" stroke="none"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></svg>);
    case "external":
      return (<svg {...common}><path d="M6 3H3v10h10v-3" /><polyline points="9 3 13 3 13 7" /><line x1="13" y1="3" x2="8" y2="8" /></svg>);
    case "trash":
      return (<svg {...common}><polyline points="3 4 13 4" /><path d="M5 4v9h6V4" /><path d="M7 4V2.5h2V4" /></svg>);
  }
}

// ── Config ──

type LanguageItem = { code: string; label: string; variants: { id: string; code: string; label: string }[] };
type LevelItem = { code: string; label: string };
type TopicItem = { slug: string; label: string; defaultLevel?: string };
type JourneyTypeItem = { id: string; slug: string; label: string };

// ── Single-select custom dropdown ──
function SingleSelectDropdown({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="jm-select">
      <div className="jm-select__trigger" onClick={() => setOpen(!open)}>
        {selectedOption ? (
          <span className="jm-chip jm-chip--teal">{selectedOption.label}</span>
        ) : (
          <span className="jm-select__placeholder">{placeholder}</span>
        )}
        <span className="jm-select__caret">▾</span>
      </div>
      {open && (
        <div className="jm-select__menu">
          {options.map((o) => {
            const isSelected = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`jm-select__option ${isSelected ? "jm-select__option--selected" : ""}`}
              >
                <span className={`jm-select__option-mark jm-select__option-mark--radio ${isSelected ? "jm-select__option-mark--selected" : ""}`}>
                  {isSelected && "●"}
                </span>
                <span>{o.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="jm-multi">
      <div className="jm-multi__trigger" onClick={() => setOpen(!open)}>
        {selectedItems.map((t) => (
          <span key={t.slug} className="jm-multi__pill">
            {t.label}
            <span className="jm-multi__pill-x" onClick={(e) => { e.stopPropagation(); onToggle(t.slug); }}>×</span>
          </span>
        ))}
        {selectedItems.length === 0 && <span className="jm-select__placeholder" style={{ fontSize: 11 }}>Seleccionar temas…</span>}
        <span className="jm-select__caret" style={{ marginLeft: "auto" }}>▾</span>
      </div>
      {open && (
        <div className="jm-select__menu" style={{ width: 280 }}>
          {available.map((t) => {
            const taken = disabled.get(t.slug);
            const isSelected = selected.has(t.slug);
            if (taken) {
              return (
                <div key={t.slug} className="jm-select__option jm-select__option--disabled">
                  <span className="jm-select__option-mark" />
                  <span>{t.label}</span>
                  <span className="jm-dim" style={{ fontSize: 10, marginLeft: "auto" }}>({taken})</span>
                </div>
              );
            }
            return (
              <div
                key={t.slug}
                className={`jm-select__option ${isSelected ? "jm-select__option--selected" : ""}`}
                onClick={() => onToggle(t.slug)}
              >
                <span className={`jm-select__option-mark ${isSelected ? "jm-select__option-mark--selected" : ""}`}>
                  {isSelected && <Icon name="check" size={9} />}
                </span>
                <span>{t.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Types ──

type JourneySummary = {
  id: string; name: string; language: string; variant: string;
  levels: string[]; topics: string[]; storiesPerTopic: number;
  status: string; createdAt: string;
  stats: { total: number; generated: number; published: number; withCover: number };
};
type StoryRow = {
  id: string; journeyId: string; slug: string | null; level: string; topic: string; slotIndex: number;
  status: string; title: string | null; synopsis: string | null; wordCount: number | null;
  vocabCount: number | null; sanityId: string | null; coverDone: boolean;
  coverUrl: string | null; audioUrl: string | null; audioStatus: string;
  audioQaStatus: string | null; audioQaScore: number | null; audioQaNotes: string | null;
  auditScore?: number | null;
  auditOffenders?: { summary?: string; highlights?: { word: string; surface: string; estimatedLevel: string }[] } | null;
  auditedAt?: string | null;
  error: string | null;
};
type TopicGroup = { journeyId: string; level: string; topic: string; label: string; stories: StoryRow[] };

// ── Confirm dialog ──
function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel, confirmTone }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  confirmTone?: "red" | "amber" | "purple" | "primary";
}) {
  const toneClass = confirmTone === "primary" ? "jm-btn--primary"
    : confirmTone === "amber" ? "jm-btn-tone-amber"
    : confirmTone === "purple" ? "jm-btn-tone-purple"
    : "jm-btn-tone-red";
  return (
    <div className="jm-backdrop">
      <div className="jm-modal">
        <p className="jm-modal__msg">{message}</p>
        <div className="jm-row" style={{ justifyContent: "flex-end" }}>
          <button onClick={onCancel} className="jm-btn jm-btn--sm">Cancelar</button>
          <button onClick={onConfirm} className={`jm-btn jm-btn--sm ${toneClass}`}>{confirmLabel ?? "Eliminar"}</button>
        </div>
      </div>
    </div>
  );
}

// Status → sdot class helper
function statusDotClass(status: string, coverDone?: boolean, audioStatus?: string) {
  if (status === "published" && coverDone && audioStatus === "ready") return "jm-sdot--published";
  if (status === "published") return "jm-sdot--partial";
  if (status === "generated" || status === "qa_pass" || status === "approved") return "jm-sdot--generated";
  if (status === "draft") return "jm-sdot--draft";
  return "jm-sdot--fail";
}

// ── Component ──

export default function MonitorClient() {
  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [allTopics, setAllTopics] = useState<TopicItem[]>([]);
  const [allLanguages, setAllLanguages] = useState<LanguageItem[]>([]);
  const [allLevels, setAllLevels] = useState<LevelItem[]>([]);
  const topicLabels: Record<string, string> = Object.fromEntries(allTopics.map((t) => [t.slug, t.label]));
  const [journeyFilter, setJourneyFilter] = useState<"all" | "pending" | "complete">("all");

  // Create form
  const [allJourneyTypes, setAllJourneyTypes] = useState<JourneyTypeItem[]>([]);
  const [journeyType, setJourneyType] = useState("");
  const [filteredTopics, setFilteredTopics] = useState<TopicItem[]>([]);
  const [language, setLanguage] = useState("");
  const [variant, setVariant] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(["a1", "a2"]));
  const [topicsByLevel, setTopicsByLevel] = useState<Record<string, Set<string>>>({});
  const [storiesPerTopic, setStoriesPerTopic] = useState(1);
  const [creating, setCreating] = useState(false);

  // Expanded journeys/topics
  const [expandedJourneyIds, setExpandedJourneyIds] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  // Picker para "Agregar tema": cuando está activo, muestra una lista
  // de topics elegibles inline dentro del nivel correspondiente. Solo
  // un picker abierto a la vez (key = `${journeyId}:${level}`).
  const [addTopicPicker, setAddTopicPicker] = useState<{
    journeyId: string;
    level: string;
  } | null>(null);
  const [addTopicOptions, setAddTopicOptions] = useState<TopicItem[]>([]);
  const [addTopicLoading, setAddTopicLoading] = useState(false);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [busyStories, setBusyStories] = useState<Set<string>>(new Set());

  // Story detail panel
  type StoryDetailData = { title?: string; text?: string; synopsis?: string; vocab?: any[] };
  const [expandedStoryIds, setExpandedStoryIds] = useState<Set<string>>(new Set());
  const [storyDetails, setStoryDetails] = useState<Map<string, StoryDetailData>>(new Map());
  const [showTextIds, setShowTextIds] = useState<Set<string>>(new Set());
  const [showVocabIds, setShowVocabIds] = useState<Set<string>>(new Set());
  const [loadingDetailIds, setLoadingDetailIds] = useState<Set<string>>(new Set());
  const [showPracticeIds, setShowPracticeIds] = useState<Set<string>>(new Set());
  const [practiceSetById, setPracticeSetById] = useState<
    Map<string, { id: string; locked: boolean; updatedAt: string; exercises: Array<{ id: string; orderIndex: number; type: string; word: string; sentence: string; audioUrl: string | null; payload: Record<string, unknown>; featured: boolean }> } | null>
  >(new Map());
  const [practiceMetaById, setPracticeMetaById] = useState<
    Map<string, { practiceVoiceId: string | null; language: string | null }>
  >(new Map());
  const [practiceLoadingIds, setPracticeLoadingIds] = useState<Set<string>>(new Set());

  type LevelAuditHighlight = { word: string; surface: string; estimatedLevel: string };
  type LevelAuditData = { cefrLevel: string; score: number; summary: string; highlights: LevelAuditHighlight[]; ranAt: number };
  const [auditResults, setAuditResults] = useState<Map<string, LevelAuditData>>(new Map());

  type AdjustReplacement = { from: string; to: string };
  type AdjustStage = "adjusting" | "auditing";
  const [adjustProgress, setAdjustProgress] = useState<Map<string, AdjustStage>>(new Map());
  const [lastReplacements, setLastReplacements] = useState<Map<string, AdjustReplacement[]>>(new Map());

  // Confirm dialog & edit
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void; confirmLabel?: string; confirmTone?: "red" | "amber" | "purple" | "primary" } | null>(null);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);

  const selectedLang = allLanguages.find((l) => l.code === language) ?? allLanguages[0];

  // Load topics filtered by journey type and auto-distribute by defaultLevel
  useEffect(() => {
    if (!journeyType) { setFilteredTopics([]); setTopicsByLevel({}); return; }
    (async () => {
      const res = await fetch(`/api/studio/topics?journeyType=${encodeURIComponent(journeyType)}`);
      if (res.ok) {
        const topics: TopicItem[] = await res.json();
        setFilteredTopics(topics);
        const byLevel: Record<string, Set<string>> = {};
        for (const t of topics) {
          const lvl = t.defaultLevel?.toLowerCase();
          if (lvl && selectedLevels.has(lvl)) {
            if (!byLevel[lvl]) byLevel[lvl] = new Set();
            byLevel[lvl].add(t.slug);
          }
        }
        setTopicsByLevel(byLevel);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyType]);

  const availableTopics = journeyType ? filteredTopics : allTopics;

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
      setTopicsByLevel({ ...topicsByLevel, [level]: new Set() });
    }
    setSelectedLevels(n);
  }

  function toggleTopicForLevel(level: string, topic: string) {
    const current = topicsByLevel[level] ?? new Set();
    setTopicsByLevel({ ...topicsByLevel, [level]: toggleSet(current, topic) });
  }

  const totalStories = [...selectedLevels].reduce((sum, level) => {
    const topics = topicsByLevel[level];
    return sum + (topics?.size ?? 0) * storiesPerTopic;
  }, 0);

  const loadJourneys = useCallback(async () => {
    setLoading(true);
    try {
      const [jRes, tRes, lRes, lvRes, jtRes] = await Promise.all([
        fetch("/api/studio/journeys"),
        fetch("/api/studio/topics"),
        fetch("/api/studio/languages"),
        fetch("/api/studio/levels"),
        fetch("/api/studio/journey-types"),
      ]);
      if (jRes.ok) setJourneys(await jRes.json());
      if (tRes.ok) setAllTopics(await tRes.json());
      if (lRes.ok) {
        const langs = await lRes.json();
        setAllLanguages(langs);
        if (!language && langs.length > 0) {
          setLanguage(langs[0].code);
          setVariant(langs[0].variants?.[0]?.code || "");
        }
      }
      if (lvRes.ok) setAllLevels(await lvRes.json());
      if (jtRes.ok) setAllJourneyTypes(await jtRes.json());
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadJourneys(); }, [loadJourneys]);

  const selectedJourneyType = allJourneyTypes.find((jt) => jt.slug === journeyType);
  const journeyName = selectedJourneyType?.label ?? journeyType;

  async function createJourney() {
    setCreating(true);
    try {
      const res = await fetch("/api/studio/journeys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: journeyName, journeyType, language, variant,
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
    setExpandedJourneyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setStories((prev) => prev.filter((s) => s.journeyId !== id));
    await loadJourneys();
  }

  async function renameJourney(id: string, name: string) {
    await fetch("/api/studio/journeys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: id, name }) });
    await loadJourneys();
    setEditingJourneyId(null);
  }

  function hydrateAuditFromStories(rows: StoryRow[]) {
    const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const updates: [string, LevelAuditData][] = [];
    for (const r of rows) {
      if (r.auditScore == null || !r.auditOffenders) continue;
      const payload = r.auditOffenders;
      const summary = typeof payload.summary === "string" ? payload.summary : "";
      const targetIdx = LEVEL_ORDER.indexOf(r.level.toUpperCase());
      const flagFromIdx = targetIdx >= 0 ? targetIdx + 2 : LEVEL_ORDER.length;
      const highlights = Array.isArray(payload.highlights)
        ? payload.highlights
            .filter((h) => h && typeof h.word === "string" && typeof h.surface === "string" && typeof h.estimatedLevel === "string")
            .filter((h) => {
              if (flagFromIdx >= LEVEL_ORDER.length) return false;
              const estIdx = LEVEL_ORDER.indexOf(h.estimatedLevel.toUpperCase());
              return estIdx >= 0 && estIdx >= flagFromIdx;
            })
        : [];
      updates.push([r.id, {
        cefrLevel: r.level.toUpperCase(),
        score: r.auditScore,
        summary,
        highlights,
        ranAt: r.auditedAt ? new Date(r.auditedAt).getTime() : Date.now(),
      }]);
    }
    if (updates.length === 0) return;
    setAuditResults((prev) => {
      const n = new Map(prev);
      for (const [id, data] of updates) n.set(id, data);
      return n;
    });
  }

  async function reloadStoriesForJourney(journeyId: string) {
    const res = await fetch(`/api/studio/journeys/stories?journeyId=${journeyId}`);
    if (res.ok) {
      const newStories: StoryRow[] = await res.json();
      setStories((prev) => [...prev.filter((s) => s.journeyId !== journeyId), ...newStories]);
      hydrateAuditFromStories(newStories);
    }
  }

  async function addLevelToJourney(journeyId: string, level: string) {
    const journey = journeys.find((j) => j.id === journeyId);
    const matchedType = allJourneyTypes.find((jt) => jt.label.toLowerCase() === journey?.name.toLowerCase());
    await fetch("/api/studio/journeys", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId, addLevels: [level], journeyTypeSlug: matchedType?.slug }) });
    await loadJourneys();
    if (expandedJourneyIds.has(journeyId)) await reloadStoriesForJourney(journeyId);
  }

  async function removeLevelFromJourney(journeyId: string, level: string) {
    await fetch("/api/studio/journeys", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId, removeLevels: [level] }) });
    await loadJourneys();
    if (expandedJourneyIds.has(journeyId)) await reloadStoriesForJourney(journeyId);
  }

  // Abre el picker "Agregar tema" para un (journey, level) específico.
  // Carga los topics disponibles del journey type (universal +
  // especializados) cuyo `defaultLevel` matchea el nivel y que
  // todavía NO estén en `journey.topics`.
  async function openAddTopicPicker(journey: JourneySummary, level: string) {
    setAddTopicPicker({ journeyId: journey.id, level });
    setAddTopicLoading(true);
    setAddTopicOptions([]);
    try {
      const matchedType = allJourneyTypes.find(
        (jt) => jt.label.toLowerCase() === journey.name.toLowerCase()
      );
      const url = matchedType
        ? `/api/studio/topics?journeyType=${encodeURIComponent(matchedType.slug)}`
        : `/api/studio/topics`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`topics fetch ${res.status}`);
      const all: TopicItem[] = await res.json();
      const journeyTopicSet = new Set(journey.topics);
      const filtered = all.filter(
        (t) => t.defaultLevel === level && !journeyTopicSet.has(t.slug)
      );
      setAddTopicOptions(filtered);
    } catch (err) {
      console.error("[add-topic-picker] failed to load topics:", err);
      setAddTopicOptions([]);
    } finally {
      setAddTopicLoading(false);
    }
  }

  // Agregar tema a un journey existente. Llama al endpoint PATCH
  // (extendido para aceptar `addTopics`) y recarga el journey. El
  // backend crea las story slots automáticamente según
  // storiesPerTopic y el defaultLevel del topic.
  async function addTopicsToJourney(journeyId: string, topicSlugs: string[]) {
    if (topicSlugs.length === 0) return;
    const journey = journeys.find((j) => j.id === journeyId);
    const matchedType = allJourneyTypes.find(
      (jt) => jt.label.toLowerCase() === journey?.name.toLowerCase()
    );
    await fetch("/api/studio/journeys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journeyId,
        addTopics: topicSlugs,
        journeyTypeSlug: matchedType?.slug,
      }),
    });
    await loadJourneys();
    if (expandedJourneyIds.has(journeyId)) await reloadStoriesForJourney(journeyId);
  }

  async function deleteStory(storyId: string) {
    await fetch("/api/studio/journeys/stories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    setExpandedStoryIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
    setStoryDetails((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
  }

  async function toggleJourney(j: JourneySummary) {
    if (expandedJourneyIds.has(j.id)) {
      setExpandedJourneyIds((prev) => { const n = new Set(prev); n.delete(j.id); return n; });
      setStories((prev) => prev.filter((s) => s.journeyId !== j.id));
      return;
    }
    setExpandedJourneyIds((prev) => new Set(prev).add(j.id));
    const res = await fetch(`/api/studio/journeys/stories?journeyId=${j.id}`);
    if (res.ok) {
      const newStories: StoryRow[] = await res.json();
      setStories((prev) => [...prev, ...newStories]);
      hydrateAuditFromStories(newStories);
    }
  }

  function getTopicGroupsForJourney(journeyId: string): TopicGroup[] {
    const map = new Map<string, TopicGroup>();
    stories.filter((s) => s.journeyId === journeyId && s.status !== "deprecated").forEach((s) => {
      const key = `${s.journeyId}:${s.level}:${s.topic}`;
      if (!map.has(key)) map.set(key, { journeyId: s.journeyId, level: s.level, topic: s.topic, label: topicLabels[s.topic] || s.topic, stories: [] });
      map.get(key)!.stories.push(s);
    });
    return Array.from(map.values());
  }

  async function generateStory(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const lastAudit = auditResults.get(storyId);
      const wordsToAvoid = lastAudit?.highlights.map((h) => h.word) ?? [];
      const res = await fetch("/api/studio/journeys/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId, wordsToAvoid }) });
      const data = await res.json();
      if (!res.ok) {
        window.alert(`Generación falló: ${data.error ?? "error desconocido"}`);
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, error: data.error ?? "Generación falló" } : s));
        return;
      }
      setStories((prev) => prev.map((s) => s.id === storyId
        ? { ...s, status: "generated", title: data.title ?? s.title, synopsis: data.synopsis ?? s.synopsis, slug: data.slug ?? s.slug, wordCount: data.wordCount ?? s.wordCount, vocabCount: data.vocabCount ?? s.vocabCount, error: null }
        : s));
      setAuditResults((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
      setLastReplacements((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
      if (expandedStoryIds.has(storyId)) {
        const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setStoryDetails((prev) => new Map(prev).set(storyId, detail));
        }
      }
      try {
        const auditRes = await fetch("/api/studio/journeys/audit-level", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditResults((prev) => new Map(prev).set(storyId, {
            cefrLevel: auditData.cefrLevel,
            score: auditData.score,
            summary: auditData.summary ?? "",
            highlights: auditData.highlights ?? [],
            ranAt: Date.now(),
          }));
          setExpandedStoryIds((prev) => new Set(prev).add(storyId));
        }
      } catch (auditErr) {
        console.warn("[generateStory] auto-audit failed:", auditErr);
      }
    } catch (err) {
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, error: String(err) } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function adjustLevel(storyId: string) {
    const audit = auditResults.get(storyId);
    if (!audit || audit.highlights.length === 0) return;
    const wordsToAvoid = audit.highlights.map((h) => h.word);
    setBusyStories((s) => new Set(s).add(storyId));
    setAdjustProgress((prev) => new Map(prev).set(storyId, "adjusting"));
    try {
      const res = await fetch("/api/studio/journeys/adjust-level", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, wordsToAvoid }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(`Ajuste falló: ${data.error ?? "error desconocido"}`);
        return;
      }
      if (data.noImprovement) {
        window.alert("El ajuste no logró bajar el conteo de palabras fuera de nivel después de varios intentos. La historia se dejó como estaba. Prueba Regenerar texto si quieres un texto distinto.");
        return;
      }
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, wordCount: data.wordCount ?? s.wordCount, vocabCount: data.vocabCount ?? s.vocabCount } : s));
      const replacements: AdjustReplacement[] = Array.isArray(data.replacements) ? data.replacements : [];
      setLastReplacements((prev) => new Map(prev).set(storyId, replacements));
      const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setStoryDetails((prev) => new Map(prev).set(storyId, detail));
      }
      if (data.audit && typeof data.audit.score === "number") {
        setAuditResults((prev) => new Map(prev).set(storyId, {
          cefrLevel: data.audit.cefrLevel,
          score: data.audit.score,
          summary: data.audit.summary ?? "",
          highlights: data.audit.highlights ?? [],
          ranAt: Date.now(),
        }));
      } else {
        setAuditResults((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
      }
    } catch (err) {
      window.alert(`Ajuste falló: ${err}`);
    } finally {
      setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; });
      setAdjustProgress((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
    }
  }

  async function auditLevel(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    setExpandedStoryIds((prev) => new Set(prev).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/audit-level", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (!res.ok) {
        window.alert(`Audit falló: ${data.error ?? "error desconocido"}`);
        return;
      }
      setAuditResults((prev) => new Map(prev).set(storyId, {
        cefrLevel: data.cefrLevel,
        score: data.score,
        summary: data.summary ?? "",
        highlights: data.highlights ?? [],
        ranAt: Date.now(),
      }));
      if (!storyDetails.has(storyId)) {
        const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setStoryDetails((prev) => new Map(prev).set(storyId, detail));
        }
      }
    } catch (err) {
      window.alert(`Audit falló: ${err}`);
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

  async function regenerateTitle(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/regenerate-title", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, title: data.title ?? s.title, slug: data.slug ?? s.slug } : s));
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function regenerateSynopsis(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/regenerate-synopsis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      if (res.ok && expandedStoryIds.has(storyId)) {
        const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setStoryDetails((prev) => new Map(prev).set(storyId, detail));
        }
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function analyzeAudio(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/analyze-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) => prev.map((s) => s.id === storyId
          ? { ...s, audioQaStatus: data.audioQa?.status ?? s.audioQaStatus, audioQaScore: data.audioQa?.score ?? s.audioQaScore, audioQaNotes: data.audioQa?.notes?.join("\n") ?? s.audioQaNotes }
          : s));
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function validateVocab(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/validate-vocab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, vocabCount: data.vocabCount ?? s.vocabCount } : s));
        if (expandedStoryIds.has(storyId)) {
          const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setStoryDetails((prev) => new Map(prev).set(storyId, detail));
          }
        }
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function regenerateVocab(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/regenerate-vocab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, vocabCount: data.vocabCount ?? s.vocabCount } : s));
        if (expandedStoryIds.has(storyId)) {
          const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setStoryDetails((prev) => new Map(prev).set(storyId, detail));
          }
        }
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function regenerateStoryText(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/regenerate-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, wordCount: data.wordCount ?? s.wordCount } : s));
        if (expandedStoryIds.has(storyId)) {
          const detailRes = await fetch(`/api/studio/journeys/story?id=${storyId}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setStoryDetails((prev) => new Map(prev).set(storyId, detail));
          }
        }
      }
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function generateAudio(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/audio", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, audioUrl: data.audioUrl ?? s.audioUrl, audioStatus: "ready" } : s));
      else setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, audioStatus: "failed", error: data.error } : s));
    } catch (err) {
      setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, audioStatus: "failed", error: String(err) } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

  async function generateCover(storyId: string) {
    setBusyStories((s) => new Set(s).add(storyId));
    try {
      const res = await fetch("/api/studio/journeys/cover", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }) });
      const data = await res.json();
      if (res.ok) setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, coverDone: true, coverUrl: data.url ?? s.coverUrl } : s));
    } finally { setBusyStories((s) => { const n = new Set(s); n.delete(storyId); return n; }); }
  }

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

  async function generateAllInTopic(group: TopicGroup) {
    const pending = group.stories.filter((s) => s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review");
    for (const s of pending) {
      await generateStory(s.id);
    }
  }

  async function generateAllInLevel(journeyId: string, level: string) {
    const pending = stories.filter((s) =>
      s.journeyId === journeyId &&
      s.level === level &&
      (s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review")
    );
    for (const s of pending) {
      await generateStory(s.id);
    }
  }

  async function regenerateAllInLevel(journeyId: string, level: string) {
    const all = stories.filter((s) =>
      s.journeyId === journeyId &&
      s.level === level &&
      (s.status === "generated" || s.status === "qa_pass" || s.status === "approved" || s.status === "published")
    );
    setConfirmAction({
      message: `¿Regenerar todas las historias del nivel ${level.toUpperCase()} (${all.length})? Sobreescribirá el contenido actual.`,
      onConfirm: async () => {
        for (const s of all) {
          await generateStory(s.id);
        }
      },
      confirmLabel: "Regenerar",
      confirmTone: "amber",
    });
  }

  function storyAction(s: StoryRow): { label: string; title?: string; disabled: boolean; onClick: () => void; tone: "primary" | "info" } | null {
    const busy = busyStories.has(s.id);
    if (busy) return { label: "…", disabled: true, onClick: () => {}, tone: "primary" };
    if (s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review")
      return { label: "Generar historia", title: "Genera título, sinopsis, cuerpo y vocabulario con Claude. Aún no publica.", disabled: false, onClick: () => generateStory(s.id), tone: "primary" };
    if (s.status === "generated" || s.status === "qa_pass" || s.status === "approved")
      return { label: "Publicar", title: "Hace la historia visible en el reader. El audio y la cover, si ya están listos, se publican junto con ella.", disabled: false, onClick: () => publishStory(s.id), tone: "primary" };
    return null;
  }

  async function toggleStoryDetail(storyId: string) {
    if (expandedStoryIds.has(storyId)) {
      setExpandedStoryIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
      setStoryDetails((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
      setShowTextIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
      setShowVocabIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
      return;
    }
    setExpandedStoryIds((prev) => new Set(prev).add(storyId));
    setLoadingDetailIds((prev) => new Set(prev).add(storyId));
    try {
      const res = await fetch(`/api/studio/journeys/story?id=${storyId}`);
      if (res.ok) {
        const detail = await res.json();
        setStoryDetails((prev) => new Map(prev).set(storyId, detail));
      }
    } finally {
      setLoadingDetailIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
    }
  }

  async function togglePracticeFor(storyId: string) {
    if (showPracticeIds.has(storyId)) {
      setShowPracticeIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
      return;
    }
    setShowPracticeIds((prev) => new Set(prev).add(storyId));
    if (practiceSetById.has(storyId)) return;
    setPracticeLoadingIds((prev) => new Set(prev).add(storyId));
    try {
      const res = await fetch(`/api/studio/practice-sets/${storyId}`);
      if (res.ok) {
        const data = await res.json();
        setPracticeSetById((prev) => new Map(prev).set(storyId, data.set ?? null));
        setPracticeMetaById((prev) => new Map(prev).set(storyId, {
          practiceVoiceId: data.practiceVoiceId ?? null,
          language: data.language ?? null,
        }));
      } else {
        setPracticeSetById((prev) => new Map(prev).set(storyId, null));
      }
    } finally {
      setPracticeLoadingIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
    }
  }

  async function updateStoryField(storyId: string, field: "title" | "synopsis", value: string) {
    try {
      await fetch("/api/studio/journeys/story", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId, [field]: value }),
      });
      if (field === "title") {
        setStories((prev) => prev.map((s) => s.id === storyId ? { ...s, title: value } : s));
      }
      setStoryDetails((prev) => {
        const existing = prev.get(storyId);
        if (!existing) return prev;
        return new Map(prev).set(storyId, { ...existing, [field]: value });
      });
    } catch { /* ignore */ }
  }

  // ── Story editor (expanded inline) ──
  function renderStoryEditor(s: StoryRow) {
    if (!expandedStoryIds.has(s.id)) return null;
    const storyDetail = storyDetails.get(s.id);
    const loadingDetail = loadingDetailIds.has(s.id);
    const showText = showTextIds.has(s.id);
    const showVocab = showVocabIds.has(s.id);
    const statusText = s.status === "published" ? (s.coverDone ? "Completa" : "Publicada (sin cover)")
      : s.status === "generated" ? "Generada"
      : s.status === "draft" ? "Borrador"
      : s.status;
    const statusTone =
      s.status === "published" && s.coverDone && s.audioStatus === "ready" ? "jm-chip--green"
      : s.status === "published" ? "jm-chip--green"
      : s.status === "generated" || s.status === "qa_pass" || s.status === "approved" ? "jm-chip--teal"
      : s.status === "draft" ? "jm-chip"
      : "jm-chip--red";

    return (
      <div className="jm-editor">
        {loadingDetail && <span className="jm-dim" style={{ fontSize: 11 }}>Cargando…</span>}

        {storyDetail && (
          <>
            <div className="jm-editor__grid">
              <div className="jm-editor__media">
                {s.coverUrl && <img className="jm-editor__cover" src={s.coverUrl} alt="" />}
                {s.audioUrl && <MiniPlayer src={s.audioUrl} />}
              </div>

              <div className="jm-editor__body">
                <div>
                  <label className="jm-field-label">Título</label>
                  <input
                    className="jm-input"
                    value={storyDetail.title ?? ""}
                    onChange={(e) => setStoryDetails((prev) => new Map(prev).set(s.id, { ...storyDetail, title: e.target.value }))}
                    onBlur={(e) => updateStoryField(s.id, "title", e.target.value)}
                  />
                </div>

                <div>
                  <label className="jm-field-label">Synopsis</label>
                  <textarea
                    className="jm-input"
                    rows={3}
                    value={storyDetail.synopsis ?? ""}
                    onChange={(e) => setStoryDetails((prev) => new Map(prev).set(s.id, { ...storyDetail, synopsis: e.target.value }))}
                    onBlur={(e) => updateStoryField(s.id, "synopsis", e.target.value)}
                  />
                </div>

                <div className="jm-row jm-row--tight jm-row--wrap">
                  <span className={`jm-chip ${statusTone}`}>{statusText}</span>
                  {s.wordCount != null && <span className="jm-chip jm-chip--mono">{s.wordCount}w</span>}
                  {s.vocabCount != null && <span className="jm-chip jm-chip--mono">{s.vocabCount}v</span>}
                  <span className="jm-row__spacer" />
                  <button
                    className={`jm-btn jm-btn--sm ${showText ? "jm-btn-tone-teal" : ""}`}
                    onClick={() => setShowTextIds((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                  >
                    {showText ? "Ocultar texto" : "Ver texto"}
                  </button>
                  <button
                    className={`jm-btn jm-btn--sm ${showVocab ? "jm-btn-tone-teal" : ""}`}
                    onClick={() => setShowVocabIds((prev) => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                  >
                    {showVocab ? "Ocultar vocab" : `Vocab (${s.vocabCount || 0})`}
                  </button>
                  {s.slug && s.status === "published" && (
                    <a href={`/stories/${s.slug}`} target="_blank" rel="noopener" className="jm-btn jm-btn-tone-teal jm-btn--sm">
                      Abrir <Icon name="external" size={11} />
                    </a>
                  )}
                </div>

                <div className="jm-tool-row">
                  <span className="jm-tool-row__label">Herramientas</span>
                  {s.title && !busyStories.has(s.id) && (
                    <button className="jm-btn jm-btn-tone-amber jm-btn--sm" onClick={() => regenerateTitle(s.id)}>
                      <Icon name="refresh" size={11} /> Regenerar título
                    </button>
                  )}
                  {s.title && !busyStories.has(s.id) && (
                    <button className="jm-btn jm-btn-tone-amber jm-btn--sm" onClick={() => regenerateSynopsis(s.id)}>
                      <Icon name="refresh" size={11} /> Regenerar synopsis
                    </button>
                  )}
                  {s.vocabCount != null && s.vocabCount > 0 && !busyStories.has(s.id) && (
                    <button className="jm-btn jm-btn-tone-teal jm-btn--sm" onClick={() => validateVocab(s.id)}>
                      Validar vocab
                    </button>
                  )}
                  {s.audioUrl && !busyStories.has(s.id) && (
                    <button className="jm-btn jm-btn-tone-teal jm-btn--sm" onClick={() => analyzeAudio(s.id)}>
                      Analizar audio
                    </button>
                  )}
                </div>

                {s.audioQaStatus && (
                  <div className="jm-row jm-row--tight jm-row--wrap">
                    <span className="jm-tool-row__label">Audio QA</span>
                    <span className={`jm-chip ${s.audioQaStatus === "pass" ? "jm-chip--green" : s.audioQaStatus === "fail" ? "jm-chip--red" : "jm-chip--amber"}`}>
                      {s.audioQaStatus}{s.audioQaScore != null ? ` · ${Math.round(s.audioQaScore * 100)}%` : ""}
                    </span>
                    {s.audioQaNotes && (
                      <span className="jm-dim" style={{ fontSize: 11, fontStyle: "italic" }} title={s.audioQaNotes}>
                        {s.audioQaNotes.split("\n")[0].slice(0, 80)}
                      </span>
                    )}
                  </div>
                )}

                {(auditResults.has(s.id) || adjustProgress.has(s.id) || lastReplacements.has(s.id)) && (() => {
                  const audit = auditResults.get(s.id);
                  const progress = adjustProgress.get(s.id);
                  const replacements = lastReplacements.get(s.id) ?? [];
                  const scoreTone = !audit ? "jm-chip--purple"
                    : audit.score >= 90 ? "jm-chip--green"
                    : audit.score >= 70 ? "jm-chip--amber"
                    : "jm-chip--red";
                  const progressLabel = progress === "adjusting" ? "Ajustando texto…" : progress === "auditing" ? "Re-auditando nivel…" : null;
                  return (
                    <div className="jm-audit">
                      <div className="jm-row jm-row--tight jm-row--wrap">
                        <span className="jm-tool-row__label">Nivel {audit?.cefrLevel ?? s.level.toUpperCase()}</span>
                        {audit && (
                          <span className={`jm-chip jm-chip--mono ${scoreTone}`}>{audit.score}%</span>
                        )}
                        {audit && audit.summary && (
                          <span className="jm-dim" style={{ fontSize: 11, fontStyle: "italic", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={audit.summary}>
                            {audit.summary}
                          </span>
                        )}
                        {progressLabel && (
                          <span style={{ fontSize: 11, color: "var(--mx-accent)", fontStyle: "italic" }}>{progressLabel}</span>
                        )}
                        <span className="jm-row__spacer" />
                        {audit && audit.highlights.length > 0 && audit.score < 95 && !busyStories.has(s.id) && (
                          <button
                            className="jm-btn jm-btn-tone-teal jm-btn--sm"
                            onClick={() => adjustLevel(s.id)}
                            title="Reescribir solo las frases con palabras que destacan"
                          >
                            Ajustar nivel
                          </button>
                        )}
                        <button
                          className="jm-btn jm-btn--xs jm-btn--ghost"
                          onClick={() => {
                            setAuditResults((prev) => { const n = new Map(prev); n.delete(s.id); return n; });
                            setLastReplacements((prev) => { const n = new Map(prev); n.delete(s.id); return n; });
                          }}
                        >
                          Ocultar
                        </button>
                      </div>
                      {audit && audit.highlights.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span className="jm-tool-row__label">Palabras que destacan</span>
                          <div className="jm-row jm-row--tight jm-row--wrap" style={{ gap: 4 }}>
                            {audit.highlights.map((h, i) => {
                              const lvlClass =
                                h.estimatedLevel === "C2" || h.estimatedLevel === "C1" ? "jm-chip--red"
                                : h.estimatedLevel === "B2" ? "jm-chip--amber"
                                : h.estimatedLevel === "B1" ? "jm-chip--amber"
                                : "jm-chip--purple";
                              return (
                                <span key={i} className={`jm-audit__highlight ${lvlClass}`} title={`${h.word} — estimado ${h.estimatedLevel}`}>
                                  <span className="jm-audit__lvl">{h.estimatedLevel}</span>
                                  <strong>{h.surface}</strong>
                                  {h.surface.toLowerCase() !== h.word.toLowerCase() && (
                                    <span className="jm-dim">({h.word})</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {replacements.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 4 }}>
                          <span className="jm-tool-row__label">Último ajuste — {replacements.length} reemplazo{replacements.length === 1 ? "" : "s"}</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {replacements.map((r, i) => (
                              <div key={i} className="jm-rep">
                                <span className="jm-rep__from">{r.from}</span>
                                <span className="jm-rep__arrow">→</span>
                                <span className="jm-rep__to">{r.to}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {showText && storyDetail.text && (
              <div className="jm-text">{storyDetail.text}</div>
            )}

            {showVocab && storyDetail.vocab && storyDetail.vocab.length > 0 && (
              <div className="jm-vocab-list">
                {storyDetail.vocab.map((v: any, i: number) => (
                  <span key={i} className="jm-vocab">
                    <strong>{v.word}</strong>{v.translation && <span className="jm-dim"> — {v.translation}</span>}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {s.error && <p style={{ margin: 0, fontSize: 11, color: "var(--mx-neg)" }}>{s.error}</p>}
      </div>
    );
  }

  // ═══════════════════ RENDER ═══════════════════
  return (
    <div className="jm-root">
      {confirmAction && (
        <ConfirmDialog
          message={confirmAction.message}
          confirmLabel={confirmAction.confirmLabel}
          confirmTone={confirmAction.confirmTone}
          onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ══ Nuevo Journey ══ */}
      <section className={`jm-panel ${allLanguages.length === 0 ? "jm-empty" : ""}`} style={allLanguages.length === 0 ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
        <header className="jm-panel__head">
          <div>
            <p className="jm-eyebrow">Nuevo Journey</p>
            <h2 className="jm-panel__title">Crear una nueva colección</h2>
          </div>
          <div className="jm-row jm-row--tight" style={{ marginLeft: "auto" }}>
            <span className="jm-mono jm-dim" style={{ fontSize: 12 }}>
              <strong>{totalStories}</strong> {totalStories === 1 ? "historia" : "historias"}
            </span>
            <button
              className="jm-btn jm-btn--primary"
              onClick={() => void createJourney()}
              disabled={creating || totalStories === 0 || !journeyType}
            >
              <Icon name="plus" size={12} /> {creating ? "Creando…" : "Crear journey"}
            </button>
          </div>
        </header>

        <div className="jm-row jm-row--wrap">
          <SingleSelectDropdown
            options={allJourneyTypes.map((jt) => ({ value: jt.slug, label: jt.label }))}
            value={journeyType}
            onChange={setJourneyType}
            placeholder="Tipo de journey"
          />
          <SingleSelectDropdown
            options={allLanguages.map((l) => ({ value: l.code, label: l.label }))}
            value={language}
            onChange={(val) => { setLanguage(val); const l = allLanguages.find((x) => x.code === val); if (l?.variants?.[0]) setVariant(l.variants[0].code); }}
            placeholder="Idioma"
          />
          {selectedLang?.variants?.length > 0 && (
            <SingleSelectDropdown
              options={selectedLang.variants.map((v) => ({ value: v.code, label: v.label }))}
              value={variant}
              onChange={setVariant}
              placeholder="Variante"
            />
          )}
          <span className="jm-row__sep" />
          {allLevels.map((l) => (
            <button
              key={l.code}
              onClick={() => toggleLevel(l.code)}
              className={`jm-btn jm-btn--sm ${selectedLevels.has(l.code) ? "jm-btn-tone-teal" : ""}`}
            >
              {l.code.toUpperCase()}
            </button>
          ))}
          <span className="jm-row__sep" />
          <div className="jm-row jm-row--tight">
            <input
              type="number"
              min={1}
              max={10}
              value={storiesPerTopic}
              onChange={(e) => setStoriesPerTopic(Math.max(1, parseInt(e.target.value) || 1))}
              className="jm-input jm-input--num"
            />
            <span className="jm-dim" style={{ fontSize: 12 }}>historia / tema</span>
          </div>
        </div>

        {[...selectedLevels].sort().map((level) => {
          const levelTopics = topicsByLevel[level] ?? new Set();
          const takenByOther = new Map<string, string>();
          for (const [otherLevel, otherTopics] of Object.entries(topicsByLevel)) {
            if (otherLevel === level || !selectedLevels.has(otherLevel)) continue;
            for (const t of otherTopics) takenByOther.set(t, otherLevel.toUpperCase());
          }
          return (
            <div key={level} className="jm-row">
              <span className="jm-level-code">{level.toUpperCase()}</span>
              <TopicDropdown
                available={availableTopics}
                selected={levelTopics}
                disabled={takenByOther}
                onToggle={(slug) => toggleTopicForLevel(level, slug)}
              />
            </div>
          );
        })}
      </section>

      {/* ══ Filter tabs ══ */}
      {journeys.length > 0 && (
        <div className="jm-row" style={{ justifyContent: "flex-end" }}>
          <div className="jm-segmented">
            {(["all", "pending", "complete"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setJourneyFilter(f)}
                className={`jm-segmented__btn ${journeyFilter === f ? "jm-segmented__btn--active" : ""}`}
              >
                {f === "all" ? "Todos" : f === "pending" ? "Pendientes" : "Completos"}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="jm-dim" style={{ fontSize: 12 }}>Cargando…</p>}

      {/* ══ Journeys list ══ */}
      {/* Orden visual: idioma → región → nivel → (tema va dentro de cada
          tarjeta, ya ordenado por el orden del journey). Idioma y región
          usan el orden de los catálogos del Studio (sortOrder); nivel usa
          el orden CEFR. Solo afecta la presentación, no los datos. */}
      {[...journeys]
        .sort((a, b) => {
          const langRank = (code: string) => {
            const i = allLanguages.findIndex((l) => l.code.toLowerCase() === code.toLowerCase());
            return i < 0 ? 999 : i;
          };
          const regionRank = (langCode: string, variantCode: string) => {
            const variants = allLanguages.find((l) => l.code.toLowerCase() === langCode.toLowerCase())?.variants ?? [];
            const i = variants.findIndex((v) => v.code.toLowerCase() === variantCode.toLowerCase());
            return i < 0 ? 999 : i;
          };
          const CEFR = ["a1", "a2", "b1", "b2", "c1", "c2"];
          const levelRank = (j: JourneySummary) =>
            Math.min(
              ...(j.levels.length ? j.levels : ["zz"]).map((l) => {
                const i = CEFR.indexOf(l.toLowerCase());
                return i < 0 ? 999 : i;
              })
            );
          return (
            langRank(a.language) - langRank(b.language) ||
            a.language.localeCompare(b.language) ||
            regionRank(a.language, a.variant) - regionRank(b.language, b.variant) ||
            a.variant.localeCompare(b.variant) ||
            levelRank(a) - levelRank(b) ||
            a.name.localeCompare(b.name)
          );
        })
        .filter((j) => {
          if (journeyFilter === "pending") return j.stats.published < j.stats.total;
          if (journeyFilter === "complete") return j.stats.total > 0 && j.stats.published === j.stats.total;
          return true;
        })
        .map((j, jIdx, jArr) => {
        const pct = j.stats.total > 0 ? Math.round((j.stats.published / j.stats.total) * 100) : 0;
        const lang = allLanguages.find((l) => l.code.toLowerCase() === j.language.toLowerCase());
        const variantLabel = lang?.variants?.find((v) => v.code.toLowerCase() === j.variant.toLowerCase())?.label || j.variant;
        const isEditing = editingJourneyId === j.id;
        const isExpanded = expandedJourneyIds.has(j.id);
        const isComplete = j.stats.total > 0 && j.stats.published === j.stats.total;
        const isEmpty = j.stats.total > 0 && j.stats.published === 0;
        const statusClass =
          j.stats.total === 0
            ? ""
            : isComplete
              ? "jm-journey--complete"
              : isEmpty
                ? "jm-journey--pending"
                : "jm-journey--progress";
        // Encabezado de grupo por idioma: solo se pinta cuando cambia el
        // idioma respecto a la tarjeta anterior (la lista ya viene ordenada
        // idioma → región → nivel), para que el orden se lea de un vistazo.
        const prevJourney = jIdx > 0 ? jArr[jIdx - 1] : null;
        const showLangHeader = !prevJourney || prevJourney.language !== j.language;

        return (
          <Fragment key={j.id}>
          {showLangHeader && (
            <div className="jm-lang-group">{(lang?.label || j.language).toUpperCase()}</div>
          )}
          <article className={`jm-journey ${statusClass} ${isExpanded ? "jm-journey--open" : ""}`}>
            <header className="jm-j-head" onClick={() => void toggleJourney(j)}>
              <span className={`jm-j-head__caret ${isExpanded ? "jm-j-head__caret--open" : ""}`}>
                <Icon name="chevron" />
              </span>
              {isEditing ? (
                <input
                  autoFocus
                  className="jm-input"
                  style={{ width: 240, height: 28, fontWeight: 600 }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === "Enter") void renameJourney(j.id, editName); if (e.key === "Escape") setEditingJourneyId(null); }}
                  onBlur={() => void renameJourney(j.id, editName)}
                />
              ) : (
                <span className="jm-j-head__id">
                  <span className="jm-j-head__idtop">
                    {variantLabel && (
                      <span className="jm-j-head__region">{variantLabel.toUpperCase()}</span>
                    )}
                    <span className="jm-chip jm-chip--mono jm-chip--level">
                      {j.levels.map((l) => l.toUpperCase()).join(", ")}
                    </span>
                  </span>
                  <span className="jm-j-head__sub">
                    <span
                      className="jm-j-head__name-mini"
                      onClick={(e) => { e.stopPropagation(); setEditingJourneyId(j.id); setEditName(j.name); }}
                      title="Click para renombrar"
                    >
                      {j.name}
                    </span>
                    {" · "}{j.topics.length} temas
                  </span>
                </span>
              )}
              <span className="jm-row__spacer" />
              <div className="jm-j-head__progress">
                <span className={`jm-j-head__count ${isEmpty ? "jm-j-head__count--empty" : ""} ${isComplete ? "jm-j-head__count--complete" : ""}`}>
                  <strong>{j.stats.published}</strong>/{j.stats.total} publicadas
                </span>
                <div className={`jm-j-head__bar ${isEmpty ? "jm-j-head__bar--empty" : ""}`}>
                  <div
                    className={`jm-j-head__bar-fill ${isComplete ? "jm-j-head__bar-fill--complete" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <button
                className={`jm-btn jm-btn--icon jm-btn--ghost ${editingStructureId === j.id ? "jm-btn-tone-teal" : ""}`}
                onClick={(e) => { e.stopPropagation(); setEditingStructureId(editingStructureId === j.id ? null : j.id); }}
                title="Editar niveles"
              >
                <Icon name="edit" size={12} />
              </button>
              <button
                className="jm-btn jm-btn--icon jm-btn--ghost"
                style={{ color: "var(--mx-neg)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction({
                    message: `Eliminar "${j.name}" con ${j.stats.total} historia${j.stats.total === 1 ? "" : "s"} (${j.stats.published} publicada${j.stats.published === 1 ? "" : "s"})? Esta acción es irreversible.`,
                    onConfirm: () => deleteJourney(j.id),
                    confirmTone: "red",
                  });
                }}
                title="Eliminar"
              >
                <Icon name="x" size={12} />
              </button>
            </header>

            {editingStructureId === j.id && (
              <div className="jm-level-editor" onClick={(e) => e.stopPropagation()}>
                <span className="jm-tool-row__label">Niveles</span>
                {allLevels.map((l) => {
                  const hasLevel = j.levels.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      onClick={() => {
                        if (hasLevel) {
                          const levelStories = stories.filter((s) => s.level === l.code);
                          const count = levelStories.length || Math.round(j.stats.total / Math.max(j.levels.length, 1));
                          setConfirmAction({
                            message: `Quitar nivel ${l.code.toUpperCase()} eliminará ~${count} historia${count === 1 ? "" : "s"}. Esta acción es irreversible.`,
                            onConfirm: () => removeLevelFromJourney(j.id, l.code),
                            confirmTone: "red",
                          });
                        } else {
                          void addLevelToJourney(j.id, l.code);
                        }
                      }}
                      className={`jm-btn jm-btn--sm ${hasLevel ? "jm-btn-tone-teal" : ""}`}
                    >
                      {l.code.toUpperCase()}
                      {hasLevel ? <Icon name="x" size={10} /> : <Icon name="plus" size={10} />}
                    </button>
                  );
                })}
              </div>
            )}

            {isExpanded && (() => {
              const journeyStories = stories.filter((s) => s.journeyId === j.id);
              const topicGroups = getTopicGroupsForJourney(j.id);
              // Dedupe case-insensitively. Historical data sometimes
              // mixes "A1" and "a1" on the same journey, which would
              // otherwise render as two separate level sections.
              const levels = [...new Set(journeyStories.map((s) => s.level.toLowerCase()))].sort();
              const journeyTopicOrder: Record<string, number> = {};
              j.topics.forEach((slug, idx) => { journeyTopicOrder[slug] = idx; });
              const sortByJourneyOrder = (a: string, b: string) => {
                const ai = journeyTopicOrder[a];
                const bi = journeyTopicOrder[b];
                if (ai === undefined && bi === undefined) return a.localeCompare(b);
                if (ai === undefined) return 1;
                if (bi === undefined) return -1;
                return ai - bi;
              };
              return (
                <div className="jm-j-body">
                  {levels.map((level) => {
                    // `level` is already lowercased above; match the
                    // group's stored value case-insensitively so
                    // mixed-case rows (legacy data) still bucket here.
                    const levelTopics = topicGroups
                      .filter((g) => g.level.toLowerCase() === level)
                      .sort((a, b) => sortByJourneyOrder(a.topic, b.topic));
                    const levelGen = levelTopics.reduce((a, g) => a + g.stories.filter((s) => ["generated", "qa_pass", "approved", "published"].includes(s.status)).length, 0);
                    const levelTotal = levelTopics.reduce((a, g) => a + g.stories.length, 0);
                    const levelPending = levelTopics.reduce((a, g) => a + g.stories.filter((s) => s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review").length, 0);
                    const levelBusy = levelTopics.some((g) => g.stories.some((s) => busyStories.has(s.id)));

                    return (
                      <div key={level}>
                        <div className="jm-level-head">
                          <span className="jm-level-code">{level.toUpperCase()}</span>
                          <span className="jm-level-head__rule" />
                          {levelPending > 0 && (
                            <button
                              className="jm-btn jm-btn--primary jm-btn--sm"
                              onClick={(e) => { e.stopPropagation(); void generateAllInLevel(j.id, level); }}
                              disabled={levelBusy}
                              title={`Generar todas las historias pendientes del nivel ${level.toUpperCase()}`}
                            >
                              <Icon name="bolt" size={11} /> {levelBusy ? "Generando…" : `Generar nivel ${level.toUpperCase()} (${levelPending})`}
                            </button>
                          )}
                          {levelPending === 0 && levelTotal > 0 && (
                            <button
                              className="jm-btn jm-btn-tone-amber jm-btn--sm"
                              onClick={(e) => { e.stopPropagation(); void regenerateAllInLevel(j.id, level); }}
                              disabled={levelBusy}
                            >
                              <Icon name="refresh" size={11} /> {levelBusy ? "Regenerando…" : `Regenerar nivel ${level.toUpperCase()}`}
                            </button>
                          )}
                          <span className="jm-chip jm-chip--mono">{levelGen}/{levelTotal}</span>
                        </div>

                        {levelTopics.map((group) => {
                          const key = `${group.journeyId}:${group.level}:${group.topic}`;
                          const isTopicOpen = expandedTopics.has(key);
                          const gen = group.stories.filter((s) => ["generated", "qa_pass", "approved", "published"].includes(s.status)).length;
                          const pendingCount = group.stories.filter((s) => s.status === "draft" || s.status === "qa_fail" || s.status === "needs_review").length;
                          const topicBusy = group.stories.some((s) => busyStories.has(s.id));
                          const allDone = group.stories.length > 0 && gen === group.stories.length;

                          return (
                            <div key={key}>
                              <div
                                className={`jm-topic-row ${isTopicOpen ? "jm-topic-row--open" : ""}`}
                                onClick={() => setExpandedTopics((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                              >
                                <span className={`jm-topic-row__label ${allDone ? "jm-topic-row__label--done" : ""}`}>{group.label}</span>
                                <div className="jm-topic-dots">
                                  {group.stories.map((s) => (
                                    <span key={s.id} className="jm-story__dot-cell">
                                      {busyStories.has(s.id)
                                        ? <span className="jm-spinner" />
                                        : <span className={`jm-sdot ${statusDotClass(s.status, s.coverDone, s.audioStatus)}`} />}
                                    </span>
                                  ))}
                                </div>
                                <span className="jm-row__spacer" />
                                {pendingCount > 0 && (
                                  <button
                                    className="jm-btn jm-btn--primary jm-btn--sm"
                                    onClick={(e) => { e.stopPropagation(); void generateAllInTopic(group); }}
                                    disabled={topicBusy}
                                  >
                                    {topicBusy ? "Generando…" : `Generar todas (${pendingCount})`}
                                  </button>
                                )}
                                <span className="jm-chip jm-chip--mono">{gen}/{group.stories.length}</span>
                                <span className={`jm-j-head__caret ${isTopicOpen ? "jm-j-head__caret--open" : ""}`}>
                                  <Icon name="chevron" size={12} />
                                </span>
                              </div>

                              {isTopicOpen && (
                                <div className="jm-stories">
                                  {group.stories.map((s) => {
                                    const action = storyAction(s);
                                    const isDetailOpen = expandedStoryIds.has(s.id);
                                    return (
                                      <div key={s.id}>
                                        <div className="jm-story">
                                          <span className="jm-story__dot-cell">
                                            {busyStories.has(s.id)
                                              ? <span className="jm-spinner" />
                                              : <span className={`jm-sdot ${statusDotClass(s.status, s.coverDone, s.audioStatus)}`} />}
                                          </span>
                                          <span
                                            className={`jm-story__title ${isDetailOpen ? "jm-story__title--open" : ""}`}
                                            onClick={() => s.title ? void toggleStoryDetail(s.id) : undefined}
                                            style={{ cursor: s.title ? "pointer" : "default" }}
                                          >
                                            {s.title || `Historia ${s.slotIndex + 1}`}
                                          </span>
                                          {s.wordCount != null && <span className="jm-chip jm-chip--mono">{s.wordCount}w</span>}
                                          {s.vocabCount != null && <span className="jm-chip jm-chip--mono">{s.vocabCount}v</span>}
                                          {action && (
                                            <button
                                              className="jm-btn jm-btn--primary jm-btn--sm"
                                              onClick={() => action.onClick()}
                                              disabled={action.disabled}
                                              title={action.title}
                                            >
                                              {action.label}
                                            </button>
                                          )}
                                          {s.title && s.status !== "draft" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                              onClick={() => setConfirmAction({
                                                message: `Regenerar texto de "${s.title}"? Sobreescribirá el contenido actual (título, sinopsis, historia, vocabulario).${s.status === "published" ? " La historia volverá a estado 'generada' y dejará de ser visible hasta que se republique." : ""}`,
                                                onConfirm: () => generateStory(s.id),
                                                confirmLabel: "Regenerar",
                                                confirmTone: "amber",
                                              })}
                                              title="Regenera todo el contenido (título, sinopsis, historia, vocab)"
                                            >
                                              Regenerar texto
                                            </button>
                                          )}
                                          {s.title && s.status !== "draft" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                              onClick={() => void auditLevel(s.id)}
                                              title={`Auditar nivel ${s.level.toUpperCase()}`}
                                            >
                                              Auditar nivel
                                            </button>
                                          )}
                                          {s.title && s.status !== "draft" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn-tone-purple jm-btn--sm"
                                              onClick={() => setConfirmAction({
                                                message: `Regenerar historia de "${s.title}"? Solo se actualizará el texto de la historia, no el título ni la sinopsis.`,
                                                onConfirm: () => regenerateStoryText(s.id),
                                                confirmLabel: "Regenerar",
                                                confirmTone: "purple",
                                              })}
                                            >
                                              Regenerar historia
                                            </button>
                                          )}
                                          {s.title && s.status !== "draft" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                              onClick={() => regenerateVocab(s.id)}
                                            >
                                              Regenerar vocab
                                            </button>
                                          )}
                                          {s.status === "published" && !s.coverDone && !busyStories.has(s.id) && (
                                            <button className="jm-btn jm-btn--sm" onClick={() => generateCover(s.id)}>
                                              Generar cover
                                            </button>
                                          )}
                                          {s.coverDone && !busyStories.has(s.id) && (
                                            <button className="jm-btn jm-btn-tone-amber jm-btn--sm" onClick={() => generateCover(s.id)}>
                                              <Icon name="refresh" size={11} /> Regenerar cover
                                            </button>
                                          )}
                                          {["generated", "qa_pass", "approved", "published"].includes(s.status) && s.audioStatus !== "ready" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn--sm"
                                              onClick={() => generateAudio(s.id)}
                                              title="Genera el audio (TTS) de la historia"
                                            >
                                              Generar audio
                                            </button>
                                          )}
                                          {s.audioStatus === "ready" && !busyStories.has(s.id) && (
                                            <button
                                              className="jm-btn jm-btn-tone-amber jm-btn--sm"
                                              onClick={() => generateAudio(s.id)}
                                              title="Reemplaza el audio actual"
                                            >
                                              <Icon name="refresh" size={11} /> Regenerar audio
                                            </button>
                                          )}
                                          {s.status === "published" && s.coverDone && s.audioStatus === "ready" && (
                                            <span style={{ color: "var(--mx-pos)" }} title="Historia completa"><Icon name="check" size={12} /></span>
                                          )}
                                          <button
                                            type="button"
                                            className={`jm-btn jm-btn-tone-purple jm-btn--sm ${showPracticeIds.has(s.id) ? "" : ""}`}
                                            onClick={(e) => { e.stopPropagation(); void togglePracticeFor(s.id); }}
                                            title="Mostrar / ocultar editor de ejercicios"
                                          >
                                            <Icon name="chevron" size={10} /> Ejercicios
                                          </button>
                                          <button
                                            className="jm-btn jm-btn--icon jm-btn--ghost jm-btn--sm"
                                            style={{ color: "var(--mx-neg)" }}
                                            onClick={() => setConfirmAction({
                                              message: `Eliminar "${s.title || "Historia " + (s.slotIndex + 1)}"?`,
                                              onConfirm: () => deleteStory(s.id),
                                              confirmTone: "red",
                                            })}
                                            title="Eliminar historia"
                                          >
                                            <Icon name="trash" size={11} />
                                          </button>
                                        </div>
                                        {renderStoryEditor(s)}
                                        {showPracticeIds.has(s.id) && (
                                          <div className="jm-practice-wrap">
                                            {practiceLoadingIds.has(s.id) ? (
                                              <p className="jm-dim" style={{ fontSize: 12, margin: 0 }}>Cargando ejercicios…</p>
                                            ) : (
                                              <PracticeSetEditor
                                                storyId={s.id}
                                                storyTitle={s.title || `Historia ${s.slotIndex + 1}`}
                                                set={practiceSetById.get(s.id) ?? null}
                                                language={practiceMetaById.get(s.id)?.language ?? ""}
                                              />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <button
                                    className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                    style={{ alignSelf: "flex-start", marginTop: 4, marginLeft: 8 }}
                                    onClick={() => void addStoryToTopic(j.id, group.level, group.topic)}
                                  >
                                    <Icon name="plus" size={11} /> Agregar historia
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Agregar tema — paridad con "Agregar nivel". Abre
                            picker inline con los topics disponibles del
                            journey type para este nivel, filtrando los
                            que ya estén. */}
                        {(() => {
                          const pickerOpen =
                            addTopicPicker?.journeyId === j.id &&
                            addTopicPicker?.level === level;
                          return (
                            <div style={{ marginTop: 6, marginLeft: 6 }}>
                              {pickerOpen ? (
                                <div className="jm-card" style={{ padding: 10 }}>
                                  <div className="jm-row" style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                                      Topics disponibles ({level.toUpperCase()})
                                    </span>
                                    <span className="jm-row__spacer" />
                                    <button
                                      className="jm-btn jm-btn--icon jm-btn--ghost jm-btn--sm"
                                      onClick={() => setAddTopicPicker(null)}
                                      title="Cerrar"
                                    >
                                      <Icon name="x" size={11} />
                                    </button>
                                  </div>
                                  {addTopicLoading ? (
                                    <p className="jm-dim" style={{ fontSize: 12, margin: 0 }}>
                                      Cargando…
                                    </p>
                                  ) : addTopicOptions.length === 0 ? (
                                    <p className="jm-dim" style={{ fontSize: 12, margin: 0 }}>
                                      No quedan topics disponibles para este nivel.
                                    </p>
                                  ) : (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {addTopicOptions.map((t) => (
                                        <button
                                          key={t.slug}
                                          className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                          onClick={async () => {
                                            await addTopicsToJourney(j.id, [t.slug]);
                                            setAddTopicOptions((prev) =>
                                              prev.filter((x) => x.slug !== t.slug)
                                            );
                                          }}
                                          title={`Agregar topic "${t.label}"`}
                                        >
                                          <Icon name="plus" size={11} /> {t.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  className="jm-btn jm-btn-tone-teal jm-btn--sm"
                                  onClick={() => void openAddTopicPicker(j, level)}
                                  title={`Agregar tema al nivel ${level.toUpperCase()}`}
                                >
                                  <Icon name="plus" size={11} /> Agregar tema
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </article>
          </Fragment>
        );
      })}
    </div>
  );
}
