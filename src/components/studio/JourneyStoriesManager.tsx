"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyCoverageGap, StudioJourneyStory } from "@/lib/studioJourneyStories";
import StudioActionLink from "@/components/studio/StudioActionLink";

type Props = {
  initialStories: StudioJourneyStory[];
  initialGaps: JourneyCoverageGap[];
};

function legacyStoryHref(story: Pick<StudioJourneyStory, "draftId" | "documentId" | "hasDraft">) {
  const documentId = story.hasDraft ? story.draftId : story.documentId;
  return `/studio/sanity/intent/edit/id=${encodeURIComponent(documentId)};type=standaloneStory`;
}

/* ── Shared styles ── */
const INPUT_CLASS = "studio-input";
const input: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const BTN_PRIMARY_CLASS = "studio-btn-primary";
const btnPrimary: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: "none",
  backgroundColor: "var(--primary)",
  color: "#fff",
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BTN_GHOST_CLASS = "studio-btn-ghost";
const btnGhost: React.CSSProperties = {
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "transparent",
  color: "var(--muted)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};

// Horizontal pill row used for the Language + Journey filters. Each
// option shows its result count under the current set of OTHER filters
// — that's what lets a user decide "Italian narrows me from 110 → 28
// without typing anything else." A pill with count=0 dims but stays
// clickable so the user can still select it (and see the empty state).
function PillRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ key: string; label: string; count: number }>;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = opt.key === value;
          const dim = !active && opt.count === 0;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                border: active ? "1px solid var(--primary)" : "1px solid var(--card-border)",
                backgroundColor: active ? "var(--primary)" : "transparent",
                color: active ? "#fff" : dim ? "var(--muted)" : "var(--foreground)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                opacity: dim ? 0.45 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
              <span style={{ opacity: 0.7, marginLeft: 6, fontWeight: 500 }}>{opt.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color,
      }}
    >
      {children}
    </span>
  );
}

// The "Standalone library" is a synthetic journey label we use for
// rows backed by prisma.standaloneStory so they sort/group alongside
// the real journeys in the Journey filter.
const STANDALONE_JOURNEY_KEY = "Standalone library";

// Build the per-row Journey label used by the Journey filter + group
// header. For journey rows we want "Italian / Traveler" so users can
// distinguish Italian-Traveler from Spanish-Traveler at a glance; for
// standalone rows we collapse them under a single "Standalone library"
// bucket since they predate the per-journey split.
function journeyLabel(story: StudioJourneyStory): string {
  if (story.source !== "journey") return STANDALONE_JOURNEY_KEY;
  const lang = story.language ? story.language.charAt(0).toUpperCase() + story.language.slice(1) : "?";
  const name = story.journeyName ?? "Journey";
  return `${lang} / ${name}`;
}

function statusKey(story: StudioJourneyStory): "draft" | "published" | "pending" {
  if (story.hasDraft) return "draft";
  if (story.published) return "published";
  return "pending";
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function JourneyStoriesManager({ initialStories, initialGaps }: Props) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [stories, setStories] = useState(initialStories);
  const [gaps, setGaps] = useState(initialGaps);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [journey, setJourney] = useState("all");
  const [level, setLevel] = useState("all");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState("all");
  // "Solo sin cover" toggle — surfaces stories that still need a cover
  // image so Jazlin (designer) can work through the list without
  // hunting visually for missing thumbnails. As covers get added the
  // rows disappear from this view, giving natural progress signal.
  const [coverFilter, setCoverFilter] = useState<"all" | "missing">("all");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [tab, setTab] = useState<"stories" | "gaps">("stories");
  // Default to grouped view because 100+ stories in one stream is the
  // exact problem this redesign exists to solve. Flat is opt-in for
  // power users who want to sort/scan across journeys.
  const [groupBy, setGroupBy] = useState<"journey" | "none">("journey");
  // Track which journey sections are collapsed. Start with all open so
  // first load doesn't hide all the content; user can collapse to
  // narrow focus.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => { setStories(initialStories); }, [initialStories]);
  useEffect(() => { setGaps(initialGaps); }, [initialGaps]);

  // Match logic factored so the per-pill counts can re-use it. Each
  // pill shows "N matches if you picked this option, holding the OTHER
  // filters constant" — that's how users decide whether to click in.
  function matchesQuery(s: StudioJourneyStory, q: string): boolean {
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      s.journeyTopic.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q) ||
      (s.journeyName ?? "").toLowerCase().includes(q)
    );
  }

  function passesExcept(
    s: StudioJourneyStory,
    skip: "language" | "journey" | "level" | "topic" | "status" | null,
  ): boolean {
    const q = query.trim().toLowerCase();
    if (!matchesQuery(s, q)) return false;
    if (skip !== "language" && language !== "all" && s.language !== language) return false;
    if (skip !== "journey" && journey !== "all" && journeyLabel(s) !== journey) return false;
    if (skip !== "level" && level !== "all" && s.cefrLevel !== level) return false;
    if (skip !== "topic" && topic !== "all") {
      const candidate = s.journeyTopic || s.topic;
      if (candidate !== topic) return false;
    }
    if (skip !== "status" && status !== "all" && statusKey(s) !== status) return false;
    if (coverFilter === "missing" && (s.coverUrl ?? "").trim()) return false;
    return true;
  }

  const filteredStories = useMemo(
    () => stories.filter((s) => passesExcept(s, null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, query, language, journey, level, topic, status, coverFilter],
  );

  function withCounts<T extends string>(
    keyOf: (s: StudioJourneyStory) => T,
    skip: "language" | "journey" | "level" | "topic",
  ): Array<{ key: T; count: number }> {
    const tally = new Map<T, number>();
    for (const s of stories) {
      if (!passesExcept(s, skip)) continue;
      const k = keyOf(s);
      if (!k) continue;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    return [...tally.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  const languageOpts = useMemo(
    () => withCounts((s) => s.language as string, "language"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, query, journey, level, topic, status],
  );
  const journeyOpts = useMemo(
    () => withCounts((s) => journeyLabel(s), "journey"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, query, language, level, topic, status],
  );
  const levelOpts = useMemo(
    () => withCounts((s) => s.cefrLevel, "level"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, query, language, journey, topic, status],
  );
  const topicOpts = useMemo(
    () => withCounts((s) => (s.journeyTopic || s.topic) as string, "topic"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, query, language, journey, level, status],
  );

  // Group filtered rows by journey label, then preserve a stable order
  // matching the journey filter dropdown. Within a group, sort by
  // level (A1→C2) then by journeyOrder.
  const LEVEL_RANK: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3, c1: 4, c2: 5 };
  const groupedStories = useMemo(() => {
    const groups = new Map<string, StudioJourneyStory[]>();
    for (const s of filteredStories) {
      const key = journeyLabel(s);
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        const la = LEVEL_RANK[a.cefrLevel?.toLowerCase()] ?? 99;
        const lb = LEVEL_RANK[b.cefrLevel?.toLowerCase()] ?? 99;
        if (la !== lb) return la - lb;
        const oa = a.journeyOrder ?? Number.MAX_SAFE_INTEGER;
        const ob = b.journeyOrder ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return (a.title || "").localeCompare(b.title || "");
      });
    }
    // Sort group entries by total count desc, then alpha — same
    // ordering as the Journey dropdown.
    return [...groups.entries()].sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredStories]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setLanguage("all");
    setJourney("all");
    setLevel("all");
    setTopic("all");
    setStatus("all");
    setCoverFilter("all");
  }

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (language !== "all" ? 1 : 0) +
    (journey !== "all" ? 1 : 0) +
    (level !== "all" ? 1 : 0) +
    (topic !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (coverFilter !== "all" ? 1 : 0);

  const missingCoverCount = useMemo(
    () => stories.filter((s) => !(s.coverUrl ?? "").trim()).length,
    [stories],
  );

  const filteredGaps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gaps.filter((g) => {
      if (q && !g.topic.toLowerCase().includes(q) && !g.topicSlug.toLowerCase().includes(q) && !g.label.toLowerCase().includes(q) && !g.variant.toLowerCase().includes(q)) return false;
      if (language !== "all" && g.language.toLowerCase() !== language) return false;
      if (level !== "all" && g.level !== level) return false;
      if (topic !== "all" && g.topicSlug !== topic) return false;
      if (status !== "all" && status !== "pending") return false;
      return true;
    });
  }, [gaps, language, level, query, status, topic]);

  async function handleCreate() {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/studio/journey-stories", { method: "POST" });
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/journey-stories");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      startTransition(() => {
        router.push(`/studio/journey-stories/${json.story.id}`);
      });
    } catch (error) {
      console.error("Failed to create Journey story", error);
      window.alert("No se pudo crear el borrador. Inténtalo otra vez.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleCreateFromGap(gap: JourneyCoverageGap) {
    setLoadingCreate(true);
    try {
      const titlePrefix = gap.focus === "General" ? "Historia del Journey" : gap.focus;
      const res = await fetch("/api/studio/journey-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${titlePrefix}: ${gap.topic}`,
          language: gap.language.toLowerCase(),
          variant: gap.variant,
          region: gap.variant === "latam" ? "colombia" : gap.variant,
          cefrLevel: gap.level,
          topic: gap.topic,
          journeyTopic: gap.topicSlug,
          journeyOrder: gap.slotOrder,
          journeyFocus: gap.focus,
          journeyEligible: true,
          published: false,
        }),
      });
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/journey-stories");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      startTransition(() => {
        router.push(`/studio/journey-stories/${json.story.id}`);
      });
    } catch (error) {
      console.error("Failed to create Journey story from gap", error);
      window.alert("No se pudo crear el borrador. Inténtalo otra vez.");
    } finally {
      setLoadingCreate(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Filters ──
          Layout follows the editor's mental model: Language is the
          coarsest split (Spanish vs German vs Italian), Journey is the
          next (Italian Traveler vs German Conversational...), then Level
          and Topic narrow within a journey. Pill rows make the top
          dimensions one-tap; the rest stays in compact dropdowns. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 16,
          borderRadius: 10,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        {/* Row 1: search + view toggle + create */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px", minWidth: 200 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Buscar</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título, slug, topic, journey name..."
              className={INPUT_CLASS}
              style={input}
            />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Vista</label>
            <div style={{ display: "inline-flex", border: "1px solid var(--card-border)", borderRadius: 8, overflow: "hidden", height: 38 }}>
              {[
                { v: "journey" as const, label: "Por journey" },
                { v: "none" as const, label: "Plana" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setGroupBy(opt.v)}
                  style={{
                    padding: "0 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: groupBy === opt.v ? "var(--primary)" : "transparent",
                    color: groupBy === opt.v ? "#fff" : "var(--muted)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => void handleCreate()}
            disabled={loadingCreate || isNavigating}
            className={BTN_PRIMARY_CLASS}
            style={{ ...btnPrimary, opacity: loadingCreate || isNavigating ? 0.6 : 1 }}
          >
            + {loadingCreate ? "Creando..." : isNavigating ? "Abriendo..." : "Nueva historia"}
          </button>
        </div>

        {/* Row 2: Language pills with live counts. Counts reflect the
            other filters so users see "Italian (28)" when nothing else
            is set, or "Italian (3)" if they've narrowed by Level=A1. */}
        <PillRow
          label="Idioma"
          value={language}
          onChange={setLanguage}
          options={[
            { key: "all", label: "Todos", count: filteredStories.length + (language !== "all" ? 1 : 0) },
            ...languageOpts.map((o) => ({ key: o.key, label: cap(o.key), count: o.count })),
          ]}
        />

        {/* Row 3: Journey pills (the strongest grouping for journey
            content). Shown as pills because there are only 4-6 options
            in production today; if the journey count grows we'd flip
            this to a select. */}
        <PillRow
          label="Journey"
          value={journey}
          onChange={setJourney}
          options={[
            { key: "all", label: "Todos", count: filteredStories.length + (journey !== "all" ? 1 : 0) },
            ...journeyOpts.map((o) => ({ key: o.key, label: o.key, count: o.count })),
          ]}
        />

        {/* Row 4: tight dropdowns for the long-tail filters */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 140px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Nivel</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS} style={input}>
              <option value="all">Todos</option>
              {levelOpts.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key.toUpperCase()} ({o.count})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Topic</label>
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className={INPUT_CLASS} style={input}>
              <option value="all">Todos</option>
              {topicOpts.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key} ({o.count})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 180px" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT_CLASS} style={input}>
              <option value="all">Todos</option>
              <option value="draft">Con borrador</option>
              <option value="published">Publicada</option>
              <option value="pending">Falta borrador</option>
            </select>
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Cover</label>
            <button
              onClick={() => setCoverFilter(coverFilter === "missing" ? "all" : "missing")}
              className={BTN_GHOST_CLASS}
              style={{
                ...btnGhost,
                height: 38,
                borderColor: coverFilter === "missing" ? "var(--primary)" : "var(--card-border)",
                backgroundColor: coverFilter === "missing" ? "var(--primary)" : "transparent",
                color: coverFilter === "missing" ? "#fff" : "var(--muted)",
                fontWeight: 600,
              }}
              title="Mostrar solo historias que aún no tienen cover"
            >
              {coverFilter === "missing" ? `✓ Solo sin cover (${missingCoverCount})` : `Solo sin cover (${missingCoverCount})`}
            </button>
          </div>
          {activeFilterCount > 0 ? (
            <button
              onClick={clearFilters}
              className={BTN_GHOST_CLASS}
              style={{ ...btnGhost, height: 38, borderColor: "var(--card-border)" }}
              title="Limpiar todos los filtros"
            >
              Limpiar filtros ({activeFilterCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, backgroundColor: "var(--card-bg)", borderRadius: 10, padding: 4, border: "1px solid var(--card-border)" }}>
        {(["stories", "gaps"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: tab === t ? "var(--primary)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            {t === "stories" ? `Historias (${filteredStories.length})` : `Huecos (${filteredGaps.length})`}
          </button>
        ))}
      </div>

      {/* ── Gaps ── */}
      {tab === "gaps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredGaps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#9989;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>No hay huecos</p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Todos los huecos del Journey están cubiertos o no coinciden con los filtros actuales.</p>
            </div>
          ) : filteredGaps.map((gap) => (
            <div
              key={gap.key}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 16px",
                borderRadius: 10,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Badge color={gap.type === "core-gap" ? "#ef4444" : "#0ea5e9"}>
                  {gap.type === "core-gap" ? "Hueco core" : "Oportunidad"}
                </Badge>
                <Badge color="#6b7280">{gap.level.toUpperCase()}</Badge>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{gap.topic}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{gap.language}/{gap.variant.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Hueco {gap.slotOrder}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => void handleCreateFromGap(gap)} disabled={loadingCreate || isNavigating} className={BTN_PRIMARY_CLASS} style={{ ...btnPrimary, height: 30, fontSize: 12, padding: "0 12px", opacity: loadingCreate || isNavigating ? 0.6 : 1 }}>
                  {loadingCreate ? "Creando..." : isNavigating ? "Abriendo..." : "Crear borrador"}
                </button>
                <StudioActionLink href={`/studio/journey-builder/${encodeURIComponent(gap.language)}/${encodeURIComponent(gap.variant)}?level=${encodeURIComponent(gap.level)}&topic=${encodeURIComponent(gap.topicSlug)}&slot=${gap.slotOrder}&focus=${encodeURIComponent(gap.focus)}`} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo creador...">
                  Abrir en creador
                </StudioActionLink>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stories table ── */}
      {tab === "stories" && (
        filteredStories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#128214;</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>
              {stories.length === 0 ? "Aún no hay historias" : "Ninguna historia coincide con estos filtros"}
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              {stories.length === 0
                ? "Crea tu primera historia del Journey para empezar."
                : "Prueba ajustando la búsqueda, el idioma, el journey o el nivel."}
            </p>
            {stories.length === 0 && (
              <button onClick={() => void handleCreate()} disabled={loadingCreate} className={BTN_PRIMARY_CLASS} style={{ ...btnPrimary, opacity: loadingCreate ? 0.6 : 1 }}>
                {loadingCreate ? "Creando..." : "+ Crear primera historia"}
              </button>
            )}
          </div>
        ) : (
          <StoriesTable
            stories={filteredStories}
            groupBy={groupBy}
            groupedStories={groupedStories}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            onExpandAll={() => setCollapsedGroups(new Set())}
            onCollapseAll={() => setCollapsedGroups(new Set(groupedStories.map(([key]) => key)))}
          />
        )
      )}
    </div>
  );
}

// Stories table is factored out so the grouped-by-journey view can
// render the same row shape inside separate <tbody> blocks under
// collapsible headers. In the "plana" view we render a single tbody
// (preserves the old behavior for power users who want a flat sort).
function StoriesTable({
  stories,
  groupBy,
  groupedStories,
  collapsedGroups,
  onToggleGroup,
  onExpandAll,
  onCollapseAll,
}: {
  stories: StudioJourneyStory[];
  groupBy: "journey" | "none";
  groupedStories: Array<[string, StudioJourneyStory[]]>;
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const grouped = groupBy === "journey";
  const COLUMNS: string[] = grouped
    ? ["Historia", "Nivel", "Topic / Orden", "Estado", "Actualizada", "Acciones"]
    : ["Historia", "Nivel", "Topic / Orden", "Focus", "Estado", "Actualizada", "Acciones"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {grouped ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", fontSize: 12 }}>
          <button onClick={onExpandAll} className={BTN_GHOST_CLASS} style={{ ...btnGhost, height: 26 }}>
            Expandir todo
          </button>
          <button onClick={onCollapseAll} className={BTN_GHOST_CLASS} style={{ ...btnGhost, height: 26 }}>
            Colapsar todo
          </button>
        </div>
      ) : null}
      <div style={{ borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--card-bg)" }}>
                {COLUMNS.map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {grouped ? (
              groupedStories.map(([groupKey, rows]) => {
                const collapsed = collapsedGroups.has(groupKey);
                const levels = Array.from(new Set(rows.map((r) => r.cefrLevel.toUpperCase()))).sort();
                const published = rows.filter((r) => r.published).length;
                return (
                  <tbody key={groupKey}>
                    <tr
                      onClick={() => onToggleGroup(groupKey)}
                      style={{ backgroundColor: "var(--card-bg)", cursor: "pointer", borderTop: "1px solid var(--card-border)" }}
                    >
                      <th colSpan={COLUMNS.length} style={{ padding: "10px 14px", textAlign: "left" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)", width: 14, display: "inline-block" }}>
                            {collapsed ? "▶" : "▼"}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{groupKey}</span>
                          <Badge color="#a78bfa">{rows.length} historias</Badge>
                          <Badge color="#10b981">{published} publicadas</Badge>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Niveles: {levels.join(" · ") || "—"}</span>
                        </div>
                      </th>
                    </tr>
                    {!collapsed && rows.map((story) => renderStoryRow(story, COLUMNS.length === 6))}
                  </tbody>
                );
              })
            ) : (
              <tbody>
                {stories.map((story) => renderStoryRow(story, false))}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// Single row renderer, used in both grouped and flat modes. The
// `hideFocusColumn` flag drops the Focus cell when we render inside a
// journey group (the group header already conveys that dimension).
function renderStoryRow(story: StudioJourneyStory, hideFocusColumn: boolean) {
  const isJourney = story.source === "journey";
  const st = story.hasDraft ? "Borrador" : story.published ? "Publicada" : "Falta borrador";
  const stColor = story.hasDraft ? "#f59e0b" : story.published ? "#10b981" : "#6b7280";
  const langLabel = story.language
    ? story.language.charAt(0).toUpperCase() + story.language.slice(1)
    : "";
  return (
    <tr
      key={story.id}
      style={{ borderBottom: "1px solid var(--card-border)" }}
      className="studio-table-row"
    >
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{story.title || "Sin título"}</div>
          {story.generationCohort === "v2-2026-06" ? (
            <Badge color="#16a34a">★ Nuevo sistema</Badge>
          ) : null}
          {isJourney && !hideFocusColumn ? (
            <Badge color="#a78bfa">
              {langLabel ? `${langLabel} · ${story.journeyName ?? "Journey"}` : (story.journeyName ?? "Journey")}
            </Badge>
          ) : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>{story.slug || "sin-slug"}</div>
      </td>
      <td style={{ padding: "10px 14px" }}><Badge color="#3b82f6">{story.cefrLevel.toUpperCase()}</Badge></td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 13, color: "var(--foreground)" }}>{story.journeyTopic || story.topic || "—"}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Orden {story.journeyOrder ?? "—"}</div>
      </td>
      {!hideFocusColumn ? (
        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{story.journeyFocus}</td>
      ) : null}
      <td style={{ padding: "10px 14px" }}><Badge color={stColor}>{st}</Badge></td>
      <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>
        {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : "—"}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {isJourney ? (
            <>
              <StudioActionLink
                href={`/studio/journey-stories/${story.id}/practice`}
                className={BTN_GHOST_CLASS}
                style={btnGhost}
                pendingLabel="Abriendo ejercicios..."
              >
                Ejercicios
              </StudioActionLink>
              <StudioActionLink
                href={`/studio/journey-manager`}
                className={BTN_GHOST_CLASS}
                style={btnGhost}
                pendingLabel="Abriendo Journey Manager..."
              >
                Manager
              </StudioActionLink>
            </>
          ) : (
            <>
              <StudioActionLink href={`/studio/journey-stories/${story.id}`} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo historia...">Editar</StudioActionLink>
              <StudioActionLink
                href={`/studio/journey-builder/${encodeURIComponent(story.language ? story.language.charAt(0).toUpperCase() + story.language.slice(1) : "Spanish")}/${encodeURIComponent(story.variant)}?level=${encodeURIComponent(story.cefrLevel)}&topic=${encodeURIComponent(story.journeyTopic)}&slot=${story.journeyOrder ?? 1}&focus=${encodeURIComponent(story.journeyFocus || "General")}`}
                className={BTN_GHOST_CLASS}
                style={btnGhost}
                pendingLabel="Abriendo creador..."
              >
                Hueco
              </StudioActionLink>
              <StudioActionLink href={legacyStoryHref(story)} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo Sanity...">Sanity</StudioActionLink>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
