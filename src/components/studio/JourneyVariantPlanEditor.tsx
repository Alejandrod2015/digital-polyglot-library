"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioToast, { showToast } from "@/components/studio/StudioToast";
import StudioConfirmDialog from "@/components/studio/StudioConfirmDialog";

type Props = {
  plan: JourneyVariantPlan;
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

export default function JourneyVariantPlanEditor({ plan, highlightedLevel, highlightedTopic, highlightedSlot, highlightedFocus }: Props) {
  const [draft, setDraft] = useState<JourneyVariantPlan>(plan);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const lastSavedRef = useRef(JSON.stringify(plan));
  const [dirty, setDirty] = useState(false);
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
    if (highlightedSlot) p.push(`slot ${highlightedSlot}`);
    if (highlightedFocus) p.push(highlightedFocus);
    return p.join(" · ");
  }, [highlightedFocus, highlightedLevel, highlightedSlot, highlightedTopic]);

  function markDirty(next: JourneyVariantPlan) {
    setDirty(JSON.stringify(next) !== lastSavedRef.current);
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
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

  function addTopic(li: number) {
    setDraft((c) => {
      const ls = [...c.levels];
      ls[li] = { ...ls[li], topics: [...ls[li].topics, { slug: `new-topic-${ls[li].topics.length + 1}`, label: "New Topic", storyTarget: ls[li].storyTargetPerTopic, checkpoint: "mixed" as const }] };
      const next = { ...c, levels: ls }; markDirty(next); return next;
    });
  }

  function addLevel() {
    setDraft((c) => {
      const next = {
        ...c,
        levels: [...c.levels, { id: `new-level-${c.levels.length + 1}`, title: `New level ${c.levels.length + 1}`, subtitle: "Describe this level", topicTarget: 1, storyTargetPerTopic: 1, topics: [{ slug: "new-topic-1", label: "New Topic", storyTarget: 1, checkpoint: "mixed" as const }] }],
      };
      markDirty(next); return next;
    });
  }

  function requestRemoveLevel(li: number) {
    const levelTitle = draft.levels[li]?.title ?? `Level ${li + 1}`;
    setConfirmDialog({
      title: `Remove "${levelTitle}"?`,
      description: `This will remove the entire level and all its topics. This action can't be undone (until you save, the original is still in Sanity).`,
      onConfirm: () => {
        setDraft((c) => { const next = { ...c, levels: c.levels.filter((_, i) => i !== li) }; markDirty(next); return next; });
        setConfirmDialog(null);
      },
    });
  }

  function requestRemoveTopic(li: number, ti: number) {
    const topicLabel = draft.levels[li]?.topics[ti]?.label ?? `Topic ${ti + 1}`;
    setConfirmDialog({
      title: `Remove "${topicLabel}"?`,
      description: `This will remove the topic from this level. Changes aren't saved until you press Save.`,
      onConfirm: () => {
        setDraft((c) => { const ls = [...c.levels]; ls[li] = { ...ls[li], topics: ls[li].topics.filter((_, i) => i !== ti) }; const next = { ...c, levels: ls }; markDirty(next); return next; });
        setConfirmDialog(null);
      },
    });
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
        showToast("Plan saved successfully", "success");
      }
    } catch (error) {
      console.error("Failed to save journey plan", error);
      if (isAuto) setAutoSaveStatus("idle");
      else showToast("Failed to save Journey plan. Please try again.", "error");
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
                Unsaved changes
              </span>
            )}
            {autoSaveStatus === "saving" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--primary)" }}>
                <span style={{ width: 10, height: 10, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
                Auto-saving...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
                All changes saved
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
            {draft.levels.length} levels · {draft.levels.reduce((s, l) => s + l.topics.length, 0)} topics
          </p>
          {spotlight && <p style={{ fontSize: 13, color: "var(--primary)", margin: "4px 0 0", fontWeight: 600 }}>Focused: {spotlight}</p>}
          {saved && <p style={{ fontSize: 12, color: "#10b981", margin: "4px 0 0", fontWeight: 600 }}>Saved at {saved}</p>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StudioActionLink href="/studio/journey-builder" className="studio-btn-ghost" style={btn} pendingLabel="Opening builder...">Back to builder</StudioActionLink>
          <StudioActionLink href={legacyPlanHref(draft)} className="studio-btn-ghost" style={btn} pendingLabel="Opening legacy CMS...">Legacy CMS</StudioActionLink>
          <button onClick={addLevel} className="studio-btn-ghost" style={btn}>+ Add level</button>
          <button onClick={() => void save(false)} disabled={saving} className="studio-btn-primary" style={{ ...btn, border: "none", backgroundColor: "var(--primary)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : "Save plan"}
          </button>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-8px 0 0", textAlign: "right" }}>
        Auto-saves after 5s of inactivity · <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", fontSize: 11, fontFamily: "monospace" }}>Cmd+S</kbd> to save now
      </p>

      {/* ── Levels ── */}
      {draft.levels.map((level, li) => {
        const hl = highlightedLevel?.toLowerCase() === level.id.toLowerCase();
        const isCollapsed = collapsed.has(li);
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, color: "var(--muted)", transition: "transform 0.15s", transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)", display: "inline-block" }}>
                  ▶
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--primary)" }}>
                  {level.id.toUpperCase()}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{level.title}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>— {level.subtitle}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--muted)" }}>
                <span>{level.topics.length} topics</span>
                <span>Target: {level.storyTargetPerTopic}/topic</span>
              </div>
            </div>

            {/* Level body */}
            {!isCollapsed && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--card-border)" }}>
                {/* Level fields */}
                <div className="studio-level-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px", gap: 10, marginTop: 14 }}>
                  <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Level ID</label><input value={level.id} onChange={(e) => updateLevel(li, "id", e.target.value)} className="studio-input" style={field} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Title</label><input value={level.title} onChange={(e) => updateLevel(li, "title", e.target.value)} className="studio-input" style={field} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Subtitle</label><input value={level.subtitle} onChange={(e) => updateLevel(li, "subtitle", e.target.value)} className="studio-input" style={field} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Stories/topic</label><input type="number" value={level.storyTargetPerTopic} onChange={(e) => updateLevel(li, "storyTargetPerTopic", Number(e.target.value) || 1)} className="studio-input" style={field} /></div>
                </div>

                {/* Topics */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", margin: 0 }}>Topics</p>
                  {level.topics.map((topic, ti) => {
                    const thl = hl && highlightedTopic?.toLowerCase() === topic.slug.toLowerCase();
                    return (
                      <div
                        key={`${level.id}:${topic.slug}:${ti}`}
                        className="studio-topic-row"
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 1.5fr 80px auto",
                          gap: 8, padding: "8px 12px", borderRadius: 8,
                          border: `1px solid ${thl ? "var(--primary)" : "var(--card-border)"}`,
                          backgroundColor: thl ? "rgba(37, 99, 235, 0.04)" : "var(--background)",
                          alignItems: "center",
                        }}
                      >
                        <input value={topic.slug} onChange={(e) => updateTopic(li, ti, "slug", slugify(e.target.value))} placeholder="topic-slug" className="studio-input" style={{ ...field, fontFamily: "monospace", fontSize: 13 }} />
                        <input value={topic.label} onChange={(e) => updateTopic(li, ti, "label", e.target.value)} placeholder="Topic label" className="studio-input" style={field} />
                        <input type="number" value={topic.storyTarget} onChange={(e) => updateTopic(li, ti, "storyTarget", Number(e.target.value) || 1)} className="studio-input" style={field} />
                        <button
                          onClick={() => requestRemoveTopic(li, ti)}
                          title="Remove topic"
                          aria-label={`Remove topic ${topic.label}`}
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
                    );
                  })}
                </div>

                {/* Level actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => addTopic(li)} className="studio-btn-ghost" style={{ ...btn, height: 32, fontSize: 12 }}>+ Add topic</button>
                  <button onClick={() => requestRemoveLevel(li)} className="studio-btn-ghost" style={{ ...btn, height: 32, fontSize: 12, color: "#ef4444", borderColor: "#ef444440" }}>
                    Remove level
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
        confirmLabel="Remove"
        danger
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmDialog(null)}
      />

      <StudioToast />
    </div>
  );
}
