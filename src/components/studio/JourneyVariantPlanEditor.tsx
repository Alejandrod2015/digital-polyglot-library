"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import type { StudioJourneyStory } from "@/lib/studioJourneyStories";
import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioToast, { showToast } from "@/components/studio/StudioToast";
import StudioConfirmDialog from "@/components/studio/StudioConfirmDialog";

type Props = {
  plan: JourneyVariantPlan;
  stories: StudioJourneyStory[];
  highlightedLevel?: string | null;
  highlightedTopic?: string | null;
  highlightedSlot?: string | null;
  highlightedFocus?: string | null;
};

function legacyPlanHref(plan: Pick<JourneyVariantPlan, "language" | "variantId">) {
  const docId = `journey-variant-plan.${plan.language.toLowerCase()}.${plan.variantId.toLowerCase()}`;
  return `/studio/sanity/intent/edit/id=${encodeURIComponent(docId)};type=journeyVariantPlan`;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const field: React.CSSProperties = {
  height: 38, width: "100%", borderRadius: 8,
  border: "1px solid var(--card-border)", backgroundColor: "var(--background)",
  color: "var(--foreground)", padding: "0 12px", fontSize: 14, outline: "none",
};

const btn: React.CSSProperties = {
  height: 36, borderRadius: 8, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", padding: "0 14px",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
};

export default function JourneyVariantPlanEditor({ plan, stories, highlightedLevel, highlightedTopic, highlightedSlot, highlightedFocus }: Props) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [draft, setDraft] = useState<JourneyVariantPlan>(plan);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(
    () =>
      new Set(
        plan.levels
          .map((_, index) => index)
          .filter((index) => plan.levels[index].id.toLowerCase() !== (highlightedLevel ?? "").toLowerCase())
      )
  );
  const [creatingTopicKey, setCreatingTopicKey] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const lastSavedRef = useRef(JSON.stringify(plan));
  const [dirty, setDirty] = useState(false);
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const AUTOSAVE_DELAY = 5000;

  /* ── Confirm dialog state ── */
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; onConfirm: () => void;
  } | null>(null);

  const spotlight = useMemo(() => {
    if (!highlightedLevel && !highlightedTopic) return null;
    const p = [];
    if (highlightedLevel) p.push(highlightedLevel.toUpperCase());
    if (highlightedTopic) p.push(highlightedTopic);
    if (highlightedSlot) p.push(`hueco ${highlightedSlot}`);
    if (highlightedFocus) p.push(highlightedFocus);
    return p.join(" · ");
  }, [highlightedFocus, highlightedLevel, highlightedSlot, highlightedTopic]);

  const storiesByTopic = useMemo(() => {
    const grouped = new Map<string, StudioJourneyStory[]>();
    for (const story of stories) {
      const key = [
        story.cefrLevel.trim().toLowerCase(),
        story.journeyTopic.trim().toLowerCase(),
      ].join("::");
      const current = grouped.get(key) ?? [];
      current.push(story);
      grouped.set(key, current);
    }
    return grouped;
  }, [stories]);

  function markDirty(next: JourneyVariantPlan) {
    setDirty(JSON.stringify(next) !== lastSavedRef.current);
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  function toggleTopic(topicKey: string) {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicKey)) next.delete(topicKey);
      else next.add(topicKey);
      return next;
    });
  }

  function storiesForTopic(levelId: string, topicSlug: string) {
    return (storiesByTopic.get(`${levelId.trim().toLowerCase()}::${topicSlug.trim().toLowerCase()}`) ?? []).sort(
      (a, b) => (a.journeyOrder ?? Number.MAX_SAFE_INTEGER) - (b.journeyOrder ?? Number.MAX_SAFE_INTEGER)
    );
  }

  function nextStoryOrder(levelId: string, topicSlug: string, target: number) {
    const usedOrders = new Set(storiesForTopic(levelId, topicSlug).map((story) => story.journeyOrder ?? 1));
    for (let order = 1; order <= Math.max(1, target); order += 1) {
      if (!usedOrders.has(order)) return order;
    }
    return Math.max(1, target + 1);
  }

  function coverageForTopic(levelId: string, topicSlug: string, target: number) {
    const created = storiesForTopic(levelId, topicSlug).length;
    const goal = Math.max(1, target);
    const ratio = Math.min(1, created / goal);
    const status = created === 0 ? "vacío" : created >= goal ? "completo" : "en progreso";
    return { created, goal, ratio, status };
  }

  function updateLevel(li: number, f: keyof JourneyVariantPlan["levels"][number], v: string | number) {
    setDraft((c) => { const ls = [...c.levels]; ls[li] = { ...ls[li], [f]: v }; const next = { ...c, levels: ls }; markDirty(next); return next; });
  }

  function updateTopic(li: number, ti: number, f: keyof JourneyVariantPlan["levels"][number]["topics"][number], v: string | number) {
    setDraft((c) => {
      const ls = [...c.levels]; const ts = [...ls[li].topics]; ts[ti] = { ...ts[ti], [f]: v };
      ls[li] = { ...ls[li], topics: ts }; const next = { ...c, levels: ls }; markDirty(next); return next;
    });
  }

  function moveTopic(li: number, ti: number, direction: -1 | 1) {
    setDraft((current) => {
      const nextIndex = ti + direction;
      if (nextIndex < 0 || nextIndex >= current.levels[li].topics.length) return current;
      const levels = [...current.levels];
      const topics = [...levels[li].topics];
      const [topic] = topics.splice(ti, 1);
      topics.splice(nextIndex, 0, topic);
      levels[li] = { ...levels[li], topics };
      const next = { ...current, levels };
      markDirty(next);
      return next;
    });
  }

  function addTopic(li: number) {
    setDraft((c) => {
      const ls = [...c.levels];
      ls[li] = { ...ls[li], topics: [...ls[li].topics, { slug: `nuevo-topic-${ls[li].topics.length + 1}`, label: "Nuevo topic", storyTarget: ls[li].storyTargetPerTopic, checkpoint: "mixed" as const }] };
      const next = { ...c, levels: ls }; markDirty(next); return next;
    });
  }

  function addLevel() {
    setDraft((c) => {
      const next = {
        ...c,
        levels: [...c.levels, { id: `nuevo-nivel-${c.levels.length + 1}`, title: `Nivel ${c.levels.length + 1}`, subtitle: "Describe este nivel", topicTarget: 1, storyTargetPerTopic: 1, topics: [{ slug: "nuevo-topic-1", label: "Nuevo topic", storyTarget: 1, checkpoint: "mixed" as const }] }],
      };
      markDirty(next); return next;
    });
  }

  function requestRemoveLevel(li: number) {
    const levelTitle = draft.levels[li]?.title ?? `Nivel ${li + 1}`;
    setConfirmDialog({
      title: `¿Quitar "${levelTitle}"?`,
      description: `Se eliminará el nivel completo con todos sus topics. El cambio no será definitivo hasta que guardes.`,
      onConfirm: () => {
        setDraft((c) => { const next = { ...c, levels: c.levels.filter((_, i) => i !== li) }; markDirty(next); return next; });
        setConfirmDialog(null);
      },
    });
  }

  function requestRemoveTopic(li: number, ti: number) {
    const topicLabel = draft.levels[li]?.topics[ti]?.label ?? `Topic ${ti + 1}`;
    setConfirmDialog({
      title: `¿Quitar "${topicLabel}"?`,
      description: `Este topic se eliminará de este nivel. El cambio no será definitivo hasta que guardes.`,
      onConfirm: () => {
        setDraft((c) => { const ls = [...c.levels]; ls[li] = { ...ls[li], topics: ls[li].topics.filter((_, i) => i !== ti) }; const next = { ...c, levels: ls }; markDirty(next); return next; });
        setConfirmDialog(null);
      },
    });
  }

  async function createStoryFromTopic(levelId: string, topicSlug: string, topicLabel: string, target: number) {
    const topicKey = `${levelId}:${topicSlug}`;
    setCreatingTopicKey(topicKey);
    try {
      const order = nextStoryOrder(levelId, topicSlug, target);
      const res = await fetch("/api/studio/journey-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Historia del Journey: ${topicLabel}`,
          language: draft.language.toLowerCase(),
          variant: draft.variantId,
          region: draft.variantId === "latam" ? "colombia" : draft.variantId,
          cefrLevel: levelId,
          topic: topicLabel,
          journeyTopic: topicSlug,
          journeyOrder: order,
          journeyFocus: "General",
          journeyEligible: true,
          published: false,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      showToast("Historia creada.", "success");
      startTransition(() => {
        router.push(`/studio/journey-stories/${json.story.id}`);
      });
    } catch (error) {
      console.error("Failed to create story from journey topic", error);
      showToast("No se pudo crear la historia desde este topic.", "error");
    } finally {
      setCreatingTopicKey(null);
    }
  }

  async function deleteStoryFromTopic(storyId: string) {
    try {
      const res = await fetch(`/api/studio/journey-stories/${storyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      showToast("Historia eliminada.", "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete topic story", error);
      showToast("No se pudo eliminar la historia.", "error");
    }
  }

  /* ── Save ── */
  const save = useCallback(async (isAuto = false) => {
    if (isAuto) setAutoSaveStatus("saving");
    else setSaving(true);
    try {
      const res = await fetch(`/api/studio/journey-builder/${encodeURIComponent(plan.language)}/${encodeURIComponent(plan.variantId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: draft }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      lastSavedRef.current = JSON.stringify(draft);
      setDirty(false);
      setSaved(new Date().toLocaleTimeString());
      if (isAuto) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        showToast("Journey guardado.", "success");
      }
    } catch (error) {
      console.error("Failed to save journey plan", error);
      if (isAuto) setAutoSaveStatus("idle");
      else showToast("No se pudo guardar el journey. Inténtalo otra vez.", "error");
    } finally {
      if (!isAuto) setSaving(false);
    }
  }, [draft, plan.language, plan.variantId]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void save(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirty, save, AUTOSAVE_DELAY]);

  /* ── Cmd+S / Ctrl+S ── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        void save(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  /* ── Unsaved changes warning ── */
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              {draft.language} · {draft.variantId.toUpperCase()}
            </h2>
              {dirty && autoSaveStatus === "idle" && (
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                Cambios sin guardar
              </span>
            )}
            {autoSaveStatus === "saving" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--primary)" }}>
                <span style={{ width: 10, height: 10, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
                Guardando...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                Todo guardado
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
            {draft.levels.length} niveles · {draft.levels.reduce((s, l) => s + l.topics.length, 0)} topics
          </p>
          {spotlight && <p style={{ fontSize: 13, color: "var(--primary)", margin: "4px 0 0", fontWeight: 600 }}>En foco: {spotlight}</p>}
          {saved && <p style={{ fontSize: 12, color: "#10b981", margin: "4px 0 0", fontWeight: 600 }}>Guardado a las {saved}</p>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StudioActionLink href="/studio/journey-builder" className="studio-btn-ghost" style={btn} pendingLabel="Abriendo creador...">Volver</StudioActionLink>
          <StudioActionLink href={legacyPlanHref(draft)} className="studio-btn-ghost" style={btn} pendingLabel="Abriendo Sanity...">Abrir en Sanity</StudioActionLink>
          <button onClick={addLevel} className="studio-btn-ghost" style={btn}>+ Añadir nivel</button>
          <button onClick={() => void save(false)} disabled={saving} className="studio-btn-primary" style={{ ...btn, border: "none", backgroundColor: "var(--primary)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "Guardar journey"}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-8px 0 0", textAlign: "right" }}>
        Guarda solo tras 5s de inactividad · <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", fontSize: 11, fontFamily: "monospace" }}>Cmd+S</kbd> para guardar ahora
      </p>

      {(() => {
        const perLevel = draft.levels.map((level) => {
          const coverage = level.topics.map((topic) => coverageForTopic(level.id, topic.slug, topic.storyTarget));
          const complete = coverage.filter((item) => item.created >= item.goal).length;
          const started = coverage.filter((item) => item.created > 0).length;
          const storiesCreated = coverage.reduce((sum, item) => sum + item.created, 0);
          const storiesGoal = coverage.reduce((sum, item) => sum + item.goal, 0);
          return { level, complete, started, storiesCreated, storiesGoal };
        });
        const completeLevels = perLevel.filter((item) => item.complete === item.level.topics.length && item.level.topics.length > 0).length;
        const incompleteLevels = perLevel.length - completeLevels;
        const totalTopics = perLevel.reduce((sum, item) => sum + item.level.topics.length, 0);
        const completeTopics = perLevel.reduce((sum, item) => sum + item.complete, 0);
        const totalStoriesCreated = perLevel.reduce((sum, item) => sum + item.storiesCreated, 0);
        const totalStoriesGoal = perLevel.reduce((sum, item) => sum + item.storiesGoal, 0);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "14px 18px", borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Niveles</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "4px 0 0" }}>{completeLevels}/{perLevel.length} completos</p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Topics</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "4px 0 0" }}>{completeTopics}/{totalTopics} completos</p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Historias</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "4px 0 0" }}>{totalStoriesCreated}/{totalStoriesGoal} creadas</p>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pendiente</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: incompleteLevels > 0 ? "#f59e0b" : "#10b981", margin: "4px 0 0" }}>{incompleteLevels} niveles</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowOnlyIncomplete((current) => !current)}
              style={{
                height: 36,
                borderRadius: 999,
                border: `1px solid ${showOnlyIncomplete ? "var(--primary)" : "var(--card-border)"}`,
                backgroundColor: showOnlyIncomplete ? "rgba(37, 99, 235, 0.12)" : "transparent",
                color: showOnlyIncomplete ? "var(--primary)" : "var(--foreground)",
                padding: "0 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {showOnlyIncomplete ? "Mostrando solo pendientes" : "Ver solo pendientes"}
            </button>
          </div>
        );
      })()}

      {/* ── Levels ── */}
      {draft.levels.map((level, li) => {
        const hl = highlightedLevel?.toLowerCase() === level.id.toLowerCase();
        const isCollapsed = collapsed.has(li);
        const topicCoverage = level.topics.map((topic) =>
          coverageForTopic(level.id, topic.slug, topic.storyTarget)
        );
        const completedTopics = topicCoverage.filter((entry) => entry.created >= entry.goal).length;
        const startedTopics = topicCoverage.filter((entry) => entry.created > 0).length;
        const totalStoriesCreated = topicCoverage.reduce((sum, entry) => sum + entry.created, 0);
        const totalStoriesGoal = topicCoverage.reduce((sum, entry) => sum + entry.goal, 0);
        const levelRatio = totalStoriesGoal > 0 ? Math.min(1, totalStoriesCreated / totalStoriesGoal) : 0;
        if (showOnlyIncomplete && completedTopics === level.topics.length && level.topics.length > 0) {
          return null;
        }
        return (
          <div
            key={level.id}
            style={{
              borderRadius: 10,
              border: `1px solid ${hl ? "var(--primary)" : "var(--card-border)"}`,
              backgroundColor: hl ? "rgba(37, 99, 235, 0.04)" : "var(--card-bg)",
              overflow: "hidden",
            }}
          >
            {/* Level header (clickable) */}
            <div
              onClick={() => toggle(li)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 18px", cursor: "pointer", userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 14, color: "var(--muted)", transition: "transform 0.15s", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", display: "inline-block" }}>
                  ▶
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  {level.title}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--muted)" }}>
                <span>{completedTopics}/{level.topics.length} topics completos</span>
                <span>{startedTopics} empezados</span>
                <span>{totalStoriesCreated}/{totalStoriesGoal} historias</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingLevelIndex((current) => (current === li ? null : li));
                  }}
                  style={{
                    height: 28,
                    borderRadius: 999,
                    border: "1px solid var(--card-border)",
                    backgroundColor: editingLevelIndex === li ? "rgba(37, 99, 235, 0.12)" : "transparent",
                    color: editingLevelIndex === li ? "var(--primary)" : "var(--foreground)",
                    padding: "0 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {editingLevelIndex === li ? "Ocultar ajustes" : "Editar nivel"}
                </button>
              </div>
            </div>

            {/* Level body */}
            {!isCollapsed && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--card-border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", marginTop: 14, padding: "10px 12px", borderRadius: 10, backgroundColor: "var(--background)", border: "1px solid var(--card-border)" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                      Cobertura del nivel
                    </p>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                      {completedTopics} de {level.topics.length} topics completos · {totalStoriesCreated} de {totalStoriesGoal} historias creadas
                    </p>
                    <div style={{ marginTop: 8, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ width: `${levelRatio * 100}%`, height: "100%", borderRadius: 999, backgroundColor: levelRatio >= 1 ? "#10b981" : levelRatio > 0 ? "var(--primary)" : "#374151" }} />
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, backgroundColor: levelRatio >= 1 ? "rgba(16, 185, 129, 0.12)" : levelRatio > 0 ? "rgba(37, 99, 235, 0.12)" : "rgba(107, 114, 128, 0.12)", color: levelRatio >= 1 ? "#10b981" : levelRatio > 0 ? "var(--primary)" : "#9ca3af", fontSize: 12, fontWeight: 700 }}>
                    {levelRatio >= 1 ? "Completo" : levelRatio > 0 ? "En progreso" : "Vacío"}
                  </div>
                </div>

                {editingLevelIndex === li ? (
                  <div className="studio-level-fields" style={{ display: "grid", gridTemplateColumns: "110px 1fr 1.2fr 120px", gap: 10, marginTop: 14, padding: "12px", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--card-border)" }}>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Nivel</label><input value={level.id} onChange={(e) => updateLevel(li, "id", e.target.value)} className="studio-input" style={field} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Nombre visible</label><input value={level.title} onChange={(e) => updateLevel(li, "title", e.target.value)} className="studio-input" style={field} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Descripción corta</label><input value={level.subtitle} onChange={(e) => updateLevel(li, "subtitle", e.target.value)} className="studio-input" style={field} /></div>
                    <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Historias por topic</label><input type="number" value={level.storyTargetPerTopic} onChange={(e) => updateLevel(li, "storyTargetPerTopic", Number(e.target.value) || 1)} className="studio-input" style={field} /></div>
                  </div>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.7fr 90px 1fr auto 32px", gap: 8, padding: "0 12px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    <span>Nombre del topic</span>
                    <span>Meta</span>
                    <span>Historias</span>
                    <span>Acciones</span>
                    <span />
                  </div>
                  {level.topics.map((topic, ti) => {
                    const thl = hl && highlightedTopic?.toLowerCase() === topic.slug.toLowerCase();
                    const topicStories = storiesForTopic(level.id, topic.slug);
                    const topicKey = `${level.id}:${topic.slug}`;
                    const topicCoverageState = coverageForTopic(level.id, topic.slug, topic.storyTarget);
                    if (showOnlyIncomplete && topicCoverageState.created >= topicCoverageState.goal) {
                      return null;
                    }
                    return (
                      <div
                        key={`${level.id}:${topic.slug}:${ti}`}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${thl ? "var(--primary)" : "var(--card-border)"}`,
                          backgroundColor: thl ? "rgba(37, 99, 235, 0.04)" : "var(--background)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.7fr 90px 1fr auto 32px",
                            gap: 8,
                            padding: "10px 12px",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleTopic(topicKey)}
                            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: "inherit", padding: 0, cursor: "pointer", textAlign: "left" }}
                          >
                            <span style={{ fontSize: 12, color: "var(--muted)", transition: "transform 0.15s", transform: expandedTopics.has(topicKey) ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{topic.label}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{topic.slug}</div>
                            </div>
                          </button>
                          <input type="number" value={topic.storyTarget} onChange={(e) => updateTopic(li, ti, "storyTarget", Number(e.target.value) || 1)} className="studio-input" style={field} />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>{topicStories.length} historia(s)</span>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "0 8px",
                                height: 24,
                                borderRadius: 999,
                                backgroundColor:
                                  topicCoverageState.status === "completo"
                                    ? "rgba(16, 185, 129, 0.12)"
                                    : topicCoverageState.status === "en progreso"
                                      ? "rgba(37, 99, 235, 0.12)"
                                      : "rgba(107, 114, 128, 0.12)",
                                color:
                                  topicCoverageState.status === "completo"
                                    ? "#10b981"
                                    : topicCoverageState.status === "en progreso"
                                      ? "var(--primary)"
                                      : "#9ca3af",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {topicCoverageState.created}/{topicCoverageState.goal}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => void createStoryFromTopic(level.id, topic.slug, topic.label, topic.storyTarget)}
                              disabled={creatingTopicKey === topicKey || isNavigating}
                              style={{
                                height: 30,
                                borderRadius: 8,
                                border: "1px solid var(--card-border)",
                                backgroundColor: "transparent",
                                color: "var(--foreground)",
                                padding: "0 10px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: creatingTopicKey === topicKey ? "default" : "pointer",
                                opacity: creatingTopicKey === topicKey ? 0.7 : 1,
                              }}
                            >
                              {creatingTopicKey === topicKey ? "Creando..." : "Añadir historia"}
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTopic(li, ti, -1)}
                              disabled={ti === 0}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: "1px solid var(--card-border)",
                                backgroundColor: "transparent",
                                color: "var(--foreground)",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: ti === 0 ? "default" : "pointer",
                                opacity: ti === 0 ? 0.35 : 1,
                              }}
                              title="Mover arriba"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveTopic(li, ti, 1)}
                              disabled={ti === level.topics.length - 1}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                border: "1px solid var(--card-border)",
                                backgroundColor: "transparent",
                                color: "var(--foreground)",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: ti === level.topics.length - 1 ? "default" : "pointer",
                                opacity: ti === level.topics.length - 1 ? 0.35 : 1,
                              }}
                              title="Mover abajo"
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            onClick={() => requestRemoveTopic(li, ti)}
                            title="Quitar topic"
                            aria-label={`Quitar topic ${topic.label}`}
                            className="studio-btn-ghost"
                            style={{
                              width: 32, height: 32, borderRadius: 6,
                              border: "1px solid var(--card-border)", backgroundColor: "transparent",
                              color: "#ef4444", cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>

                        {expandedTopics.has(topicKey) ? (
                          <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--card-border)" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                              {topicStories.length === 0 ? (
                                <div style={{ fontSize: 12, color: "var(--muted)", padding: "6px 2px" }}>
                                  Este topic aún no tiene historias.
                                </div>
                              ) : (
                                topicStories.map((story) => (
                                  <div
                                    key={story.id}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "minmax(0, 1fr) auto",
                                      gap: 12,
                                      alignItems: "center",
                                      padding: "10px 12px",
                                      borderRadius: 8,
                                      backgroundColor: "rgba(255,255,255,0.02)",
                                      border: "1px solid var(--card-border)",
                                    }}
                                  >
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                                        {story.title || "Sin título"}
                                      </div>
                                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                        Orden {story.journeyOrder ?? "—"} · {story.journeyFocus || "General"} · {story.hasDraft ? "Borrador" : story.published ? "Publicada" : "Pendiente"}
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      <StudioActionLink
                                        href={`/studio/journey-stories/${story.id}`}
                                        style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid var(--card-border)", backgroundColor: "transparent", color: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
                                        pendingLabel="Abriendo..."
                                      >
                                        Editar
                                      </StudioActionLink>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDialog({
                                            title: `¿Eliminar "${story.title || "esta historia"}"?`,
                                            description: "Se eliminará esta historia del Journey. Esta acción no se puede deshacer.",
                                            onConfirm: () => {
                                              void deleteStoryFromTopic(story.id);
                                              setConfirmDialog(null);
                                            },
                                          })
                                        }
                                        style={{
                                          height: 30,
                                          borderRadius: 8,
                                          border: "1px solid rgba(239,68,68,0.25)",
                                          backgroundColor: "transparent",
                                          color: "#ef4444",
                                          padding: "0 10px",
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Level actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => addTopic(li)} className="studio-btn-ghost" style={{ ...btn, height: 32, fontSize: 12 }}>+ Añadir topic</button>
                  <button onClick={() => requestRemoveLevel(li)} className="studio-btn-ghost" style={{ ...btn, height: 32, fontSize: 12, color: "#ef4444", borderColor: "#ef444440" }}>
                    Quitar nivel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Confirm dialog ── */}
      <StudioConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ""}
        description={confirmDialog?.description ?? ""}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />

      <StudioToast />
    </div>
  );
}
