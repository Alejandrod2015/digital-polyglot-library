"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./covers.css";
import { LangTag, LevelCode, StatusBadge, type CoverStatus } from "@/components/studio/primitives";

type Provider =
  | "flux"
  | "openai"
  | "gemini-imagen-4"
  | "gemini-imagen-4-ultra"
  | "gemini-flash-image"
  | "gemini-3-pro-image";

const PROVIDERS: { value: Provider; label: string; cost: string }[] = [
  { value: "flux", label: "Flux 2 Pro (BFL)", cost: "~$0.04-0.10/img" },
  { value: "openai", label: "OpenAI gpt-image-1", cost: "~$0.04/img" },
  { value: "gemini-imagen-4", label: "Gemini Imagen 4", cost: "~$0.04/img" },
  { value: "gemini-imagen-4-ultra", label: "Gemini Imagen 4 Ultra", cost: "~$0.06/img" },
  { value: "gemini-flash-image", label: "Gemini 2.5 Flash Image", cost: "más barato" },
  { value: "gemini-3-pro-image", label: "Gemini 3 Pro Image", cost: "preview" },
];

type Journey = {
  id: string;
  name: string;
  language: string;
  variant: string;
};

type Story = {
  id: string;
  slug: string | null;
  level: string;
  topic: string;
  slotIndex: number;
  status: string;
  title: string | null;
  coverUrl: string | null;
  coverDone: boolean;
};

type VariantResult = {
  variant: "cool-cartoon" | "warm-cartoon" | "earthy-cartoon";
  url: string | null;
  filename: string | null;
  error: string | null;
};

const VARIANT_MOOD: Record<VariantResult["variant"], string> = {
  "cool-cartoon": "Cool",
  "warm-cartoon": "Warm",
  "earthy-cartoon": "Earthy",
};

type StatusFilter = "all" | "missing" | "review" | "published";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "missing", label: "Sin cover" },
  { value: "review", label: "Por revisar" },
  { value: "published", label: "Listas" },
];

const STYLE_OPTIONS = ["Cinematic", "Watercolor", "Editorial", "Studio Ghibli", "Photoreal"];

/**
 * Coalesces the API's story shape to a 4-state lifecycle for the
 * status badge + filters. The current backend exposes `coverDone`
 * only; `review` is local (whenever a variants batch is pending in
 * memory). `stale` isn't observable yet; flagged for a future field.
 */
function statusForStory(story: Story, hasPendingVariants: boolean): CoverStatus {
  if (hasPendingVariants) return "review";
  if (story.coverDone && story.coverUrl) return "published";
  return "missing";
}

function languageCode(language: string): string {
  const lc = language.toLowerCase();
  if (lc.startsWith("es") || lc === "spanish") return "es";
  if (lc.startsWith("it") || lc === "italian") return "it";
  if (lc.startsWith("de") || lc === "german") return "de";
  if (lc.startsWith("fr") || lc === "french") return "fr";
  if (lc.startsWith("pt") || lc === "portuguese") return "pt";
  return lc.slice(0, 2) || "??";
}

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "search":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case "wand":
      return (
        <svg {...p}>
          <path d="M15 4V2" />
          <path d="M15 16v-2" />
          <path d="M8 9h2" />
          <path d="M20 9h2" />
          <path d="M17.8 11.8 19 13" />
          <path d="M17.8 6.2 19 5" />
          <path d="m3 21 9-9" />
          <path d="M12.2 6.2 11 5" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...p} fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...p}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
      );
    case "eye":
      return (
        <svg {...p}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "image":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "more":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case "layers":
      return (
        <svg {...p}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    default:
      return null;
  }
}

export default function StudioCoversClient() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [storiesByJourney, setStoriesByJourney] = useState<Record<string, Story[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [journeyFilter, setJourneyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);

  // Pending variants are tracked per story id locally. They aren't on
  // the API yet; the lifecycle stays "review" until the user picks one.
  const [variantsByStory, setVariantsByStory] = useState<Record<string, VariantResult[]>>({});
  const [generatingStoryId, setGeneratingStoryId] = useState<string | null>(null);
  const [chosenByStory, setChosenByStory] = useState<Record<string, number>>({});

  // Per-story rail state. The handoff puts these on the rail, but they
  // need to survive when the user clicks another story and comes back
  // (otherwise the prompt edit gets wiped). So we key by storyId.
  const [promptByStory, setPromptByStory] = useState<Record<string, string>>({});
  const [model, setModel] = useState<Provider>("gemini-imagen-4");
  const [qty, setQty] = useState<1 | 3 | 6>(3);
  const [aspect, setAspect] = useState<"1:1" | "3:2" | "16:9">("3:2");
  const [styleSel, setStyleSel] = useState<string>("Cinematic");
  const [moreOpen, setMoreOpen] = useState(false);

  /* ── Load journeys ────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/journeys")
      .then(async (r) => ({ status: r.status, body: await r.json() }))
      .then(({ status, body }) => {
        if (cancelled) return;
        if (!Array.isArray(body)) {
          const msg = body && typeof body === "object" && "error" in body ? (body as { error: string }).error : `HTTP ${status}`;
          setError(`No journeys (${msg}). ¿Estás autenticado en Studio?`);
          setJourneys([]);
          return;
        }
        setJourneys(body as Journey[]);
      })
      .catch((err) => !cancelled && setError(`Failed to load journeys: ${err}`));
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Load stories for every journey ───────────────── */
  useEffect(() => {
    if (journeys.length === 0) return;
    let cancelled = false;
    Promise.all(
      journeys.map((j) =>
        fetch(`/api/studio/journeys/stories?journeyId=${encodeURIComponent(j.id)}`)
          .then((r) => r.json())
          .then((rows: Story[]) => {
            const safe = Array.isArray(rows) ? rows : [];
            return [j.id, safe.filter((s) => s.title && s.status === "published")] as const;
          })
          .catch((err) => {
            console.error(`stories load failed for ${j.id}`, err);
            return [j.id, [] as Story[]] as const;
          })
      )
    ).then((pairs) => {
      if (cancelled) return;
      setStoriesByJourney(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [journeys]);

  /* ── Filtered + grouped stories ───────────────────── */
  const allStoriesWithJourney = useMemo(() => {
    const list: Array<{ story: Story; journey: Journey }> = [];
    for (const j of journeys) {
      const rows = storiesByJourney[j.id] ?? [];
      for (const story of rows) list.push({ story, journey: j });
    }
    return list;
  }, [journeys, storiesByJourney]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return allStoriesWithJourney.filter(({ story, journey }) => {
      if (journeyFilter !== "all" && journey.id !== journeyFilter) return false;
      const status = statusForStory(story, !!variantsByStory[story.id]);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (ql) {
        const hay =
          ((story.title ?? "") + " " + (story.slug ?? "") + " " + story.topic).toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [allStoriesWithJourney, q, journeyFilter, statusFilter, variantsByStory]);

  const groups = useMemo(() => {
    const m = new Map<string, { journey: Journey; items: Story[] }>();
    for (const { story, journey } of filtered) {
      if (!m.has(journey.id)) m.set(journey.id, { journey, items: [] });
      m.get(journey.id)!.items.push(story);
    }
    return Array.from(m.values()).map((g) => ({
      ...g,
      items: g.items.slice().sort((a, b) => {
        const k = (s: Story) => `${s.level}|${s.topic}|${s.slotIndex}|${s.title}`;
        return k(a).localeCompare(k(b));
      }),
    }));
  }, [filtered]);

  // Default selection: first story of the first group when nothing is
  // selected. Switching filters doesn't yank the selection unless the
  // current one drops out of view.
  useEffect(() => {
    if (selectedId && filtered.some(({ story }) => story.id === selectedId)) return;
    setSelectedId(filtered[0]?.story.id ?? null);
  }, [filtered, selectedId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return filtered.find(({ story }) => story.id === selectedId) ?? null;
  }, [filtered, selectedId]);

  /* ── Generate / select ────────────────────────────── */
  const generate = useCallback(async () => {
    if (!selected) return;
    const storyId = selected.story.id;
    setGeneratingStoryId(storyId);
    setError(null);
    try {
      const r = await fetch("/api/studio/journeys/cover-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, provider: model }),
      });
      if (!r.ok) {
        const text = await r.text();
        setError(`Generation failed: ${r.status} ${text.slice(0, 200)}`);
        return;
      }
      const data = await r.json();
      setVariantsByStory((cur) => ({ ...cur, [storyId]: data.variants ?? [] }));
      setChosenByStory((cur) => {
        const next = { ...cur };
        delete next[storyId];
        return next;
      });
    } catch (err) {
      setError(`Generation error: ${err}`);
    } finally {
      setGeneratingStoryId(null);
    }
  }, [selected, model]);

  const confirmChoice = useCallback(async () => {
    if (!selected) return;
    const storyId = selected.story.id;
    const chosenIdx = chosenByStory[storyId];
    const variants = variantsByStory[storyId];
    if (chosenIdx == null || !variants) return;
    const url = variants[chosenIdx]?.url;
    if (!url) return;
    try {
      const r = await fetch("/api/studio/journeys/cover-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, selectVariantUrl: url }),
      });
      if (!r.ok) {
        const text = await r.text();
        setError(`Apply failed: ${r.status} ${text.slice(0, 200)}`);
        return;
      }
      // Reflect server change locally.
      setStoriesByJourney((cur) => {
        const next = { ...cur };
        for (const [jid, rows] of Object.entries(next)) {
          next[jid] = rows.map((s) =>
            s.id === storyId ? { ...s, coverUrl: url, coverDone: true } : s
          );
        }
        return next;
      });
      setVariantsByStory((cur) => {
        const next = { ...cur };
        delete next[storyId];
        return next;
      });
      setChosenByStory((cur) => {
        const next = { ...cur };
        delete next[storyId];
        return next;
      });
    } catch (err) {
      setError(`Apply error: ${err}`);
    }
  }, [selected, chosenByStory, variantsByStory]);

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="covers-v2">
      {/* Toolbar */}
      <div className="covers-toolbar">
        <div className="covers-search">
          <span className="covers-search__icon">
            <Icon name="search" size={13} />
          </span>
          <input
            placeholder="Buscar historia…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="covers-select"
          value={journeyFilter}
          onChange={(e) => setJourneyFilter(e.target.value)}
        >
          <option value="all">Todos los journeys</option>
          {journeys.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name || `${j.language} · ${j.variant}`}
            </option>
          ))}
        </select>

        <span style={{ flex: 1 }} />

        <div className="covers-segmented">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={
                "covers-segmented__btn" +
                (statusFilter === f.value ? " covers-segmented__btn--active" : "")
              }
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="covers-error">{error}</div>}

      <div className="covers-content">
        {/* Left list */}
        <LeftList
          groups={groups}
          total={filtered.length}
          selectedId={selectedId}
          onSelect={setSelectedId}
          variantsByStory={variantsByStory}
        />

        {/* Studio */}
        {selected ? (
          <Studio
            story={selected.story}
            journey={selected.journey}
            prompt={promptByStory[selected.story.id] ?? defaultPromptFor(selected.story)}
            onPromptChange={(value) =>
              setPromptByStory((cur) => ({ ...cur, [selected.story.id]: value }))
            }
            model={model}
            onModelChange={setModel}
            qty={qty}
            onQtyChange={setQty}
            aspect={aspect}
            onAspectChange={setAspect}
            styleSel={styleSel}
            onStyleChange={setStyleSel}
            moreOpen={moreOpen}
            onMoreToggle={() => setMoreOpen((x) => !x)}
            generating={generatingStoryId === selected.story.id}
            onGenerate={generate}
            variants={variantsByStory[selected.story.id] ?? null}
            chosenIdx={chosenByStory[selected.story.id] ?? null}
            onChooseVariant={(idx) =>
              setChosenByStory((cur) => ({ ...cur, [selected.story.id]: idx }))
            }
            onConfirm={confirmChoice}
            onUploaded={(coverUrl) =>
              setStoriesByJourney((cur) => {
                const next = { ...cur };
                for (const [jid, rows] of Object.entries(next)) {
                  next[jid] = rows.map((s) =>
                    s.id === selected.story.id ? { ...s, coverUrl, coverDone: true } : s
                  );
                }
                return next;
              })
            }
          />
        ) : (
          <EmptyStudio />
        )}
      </div>
    </div>
  );
}

/* ── Default prompt heuristic ─────────────────────────────── */
function defaultPromptFor(story: Story): string {
  const title = (story.title ?? "").trim();
  return [
    title
      ? `Cover ilustrativo para "${title}".`
      : "Cover ilustrativo para una historia A1.",
    "Luz cinematográfica cálida, estilo editorial moderno, personaje en acción, ambiente reconocible en 2 segundos.",
  ].join(" ");
}

/* ── Left list ────────────────────────────────────────────── */
function LeftList({
  groups,
  total,
  selectedId,
  onSelect,
  variantsByStory,
}: {
  groups: { journey: Journey; items: Story[] }[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  variantsByStory: Record<string, VariantResult[]>;
}) {
  return (
    <div className="covers-list">
      <div className="covers-list__header">
        <span className="covers-list__title">Historias</span>
        <span className="covers-list__count">{total}</span>
      </div>
      <div className="covers-list__scroll">
        {groups.length === 0 && (
          <div style={{ padding: 20, color: "var(--mx-muted)", fontSize: 12 }}>
            Sin resultados.
          </div>
        )}
        {groups.map(({ journey, items }) => {
          const lang = languageCode(journey.language);
          return (
            <div key={journey.id}>
              <div className="cl-group">
                <LangTag lang={lang} />
                <span className="cl-group__name">
                  {journey.name || `${journey.language} · ${journey.variant}`}
                </span>
                <span className="cl-group__rule" />
              </div>
              {items.map((story) => {
                const status = statusForStory(story, !!variantsByStory[story.id]);
                const active = selectedId === story.id;
                return (
                  <div
                    key={story.id}
                    className={"cl-row" + (active ? " cl-row--active" : "")}
                    onClick={() => onSelect(story.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div
                      className="cl-thumb"
                      style={
                        story.coverUrl
                          ? { backgroundImage: `url(${story.coverUrl})` }
                          : undefined
                      }
                    >
                      {!story.coverUrl && <div className="cl-thumb__missing">＋</div>}
                    </div>
                    <div className="cl-row__body">
                      <div
                        className={
                          "cl-row__title" +
                          (status === "missing" ? " cl-row__title--missing" : "")
                        }
                      >
                        {story.title ?? "(sin título)"}
                      </div>
                      <div className="cl-row__meta">
                        <LevelCode level={story.level} />
                        <span>·</span>
                        <span>{story.topic}</span>
                      </div>
                    </div>
                    <div>
                      <StatusBadge status={status} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Empty studio (no selection) ─────────────────────────── */
function EmptyStudio() {
  return (
    <section className="covers-studio">
      <div className="covers-empty">
        <div className="covers-empty__inner">
          <Icon name="layers" size={28} />
          <h3 className="covers-empty__title">Elige una historia</h3>
          <p className="covers-empty__body">Para gestionar o crear su portada.</p>
        </div>
      </div>
    </section>
  );
}

/* ── Studio (right pane) ─────────────────────────────────── */
function Studio({
  story,
  journey,
  prompt,
  onPromptChange,
  model,
  onModelChange,
  qty,
  onQtyChange,
  aspect,
  onAspectChange,
  styleSel,
  onStyleChange,
  moreOpen,
  onMoreToggle,
  generating,
  onGenerate,
  variants,
  chosenIdx,
  onChooseVariant,
  onConfirm,
  onUploaded,
}: {
  story: Story;
  journey: Journey;
  prompt: string;
  onPromptChange: (v: string) => void;
  model: Provider;
  onModelChange: (m: Provider) => void;
  qty: 1 | 3 | 6;
  onQtyChange: (q: 1 | 3 | 6) => void;
  aspect: "1:1" | "3:2" | "16:9";
  onAspectChange: (a: "1:1" | "3:2" | "16:9") => void;
  styleSel: string;
  onStyleChange: (s: string) => void;
  moreOpen: boolean;
  onMoreToggle: () => void;
  generating: boolean;
  onGenerate: () => void;
  variants: VariantResult[] | null;
  chosenIdx: number | null;
  onChooseVariant: (idx: number) => void;
  onConfirm: () => void;
  onUploaded: (coverUrl: string) => void;
}) {
  const lang = languageCode(journey.language);
  const [uploading, setUploading] = useState(false);

  async function handleUploadCover(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("storyId", story.id);
      fd.append("file", file);
      const r = await fetch("/api/studio/journeys/cover-upload", { method: "POST", body: fd });
      if (!r.ok) {
        const t = await r.text();
        alert(`Subida falló: ${r.status} ${t.slice(0, 200)}`);
        return;
      }
      const data = (await r.json()) as { coverUrl?: string };
      if (data.coverUrl) onUploaded(data.coverUrl);
    } catch (err) {
      alert(`Error subiendo portada: ${err}`);
    } finally {
      setUploading(false);
    }
  }
  const status = statusForStory(story, !!variants);
  const costPerImg =
    parseFloat((PROVIDERS.find((p) => p.value === model)?.cost ?? "0").replace(/[^0-9.]/g, "")) ||
    0;
  const totalCost = (costPerImg * qty).toFixed(2);

  return (
    <section className="covers-studio">
      {/* Head */}
      <div className="studio-head">
        <div className="studio-head__lhs">
          <div className="studio-head__crumb">
            <LangTag lang={lang} />
            <span>
              {journey.name || `${journey.language} · ${journey.variant}`}
            </span>
            <span className="sep">/</span>
            <LevelCode level={story.level} />
            <span className="sep">/</span>
            <span>{story.topic}</span>
          </div>
          <h2 className="studio-head__title">{story.title ?? "(sin título)"}</h2>
        </div>
        <div className="studio-head__actions">
          <StatusBadge status={status} />
          <label
            title="Subir una portada manualmente (png/jpg/webp, máx 8 MB)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 11px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.16)",
              cursor: uploading || !story.id ? "default" : "pointer",
              opacity: uploading || !story.id ? 0.55 : 1,
            }}
          >
            {uploading ? "Subiendo…" : "Subir portada"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              disabled={uploading || !story.id}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleUploadCover(f);
              }}
            />
          </label>
          <button type="button" className="icon-btn" title="Más">
            <Icon name="more" size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="studio-body">
        <CoverHero story={story} status={status} />
        <StudioRail
          prompt={prompt}
          onPromptChange={onPromptChange}
          model={model}
          onModelChange={onModelChange}
          qty={qty}
          onQtyChange={onQtyChange}
          aspect={aspect}
          onAspectChange={onAspectChange}
          styleSel={styleSel}
          onStyleChange={onStyleChange}
          moreOpen={moreOpen}
          onMoreToggle={onMoreToggle}
          totalCost={totalCost}
          generating={generating}
          onGenerate={onGenerate}
          disabled={!story.id}
        />
      </div>

      {/* Variants */}
      {variants && variants.length > 0 ? (
        <VariantsBlock
          variants={variants}
          chosenIdx={chosenIdx}
          onChooseVariant={onChooseVariant}
          onConfirm={onConfirm}
        />
      ) : status === "missing" ? (
        <div className="variants-block">
          <div className="missing-prompt">
            Sin portada. Ajusta el prompt y pulsa <b>Generar</b>.
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ── Cover hero ──────────────────────────────────────────── */
function CoverHero({ story, status }: { story: Story; status: CoverStatus }) {
  if (status === "missing") {
    return (
      <div className="cover-hero cover-hero--empty">
        <div className="empty-inner">
          <Icon name="image" size={22} />
          <b>Todavía no hay portada</b>
          <span>Genera variantes desde el panel de la derecha.</span>
        </div>
      </div>
    );
  }
  return (
    <div className="cover-hero">
      <div
        className="cover-hero__img"
        style={story.coverUrl ? { backgroundImage: `url(${story.coverUrl})` } : undefined}
      />
      <div className="cover-hero__overlay">
        <span className="cover-hero__badge">
          <Icon name="check" size={10} /> Portada activa
        </span>
        {status === "stale" && (
          <span className="cover-hero__badge cover-hero__badge--stale">
            <Icon name="refresh" size={10} /> Texto cambió
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Studio rail (consolidated card) ─────────────────────── */
function StudioRail({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  qty,
  onQtyChange,
  aspect,
  onAspectChange,
  styleSel,
  onStyleChange,
  moreOpen,
  onMoreToggle,
  totalCost,
  generating,
  onGenerate,
  disabled,
}: {
  prompt: string;
  onPromptChange: (v: string) => void;
  model: Provider;
  onModelChange: (m: Provider) => void;
  qty: 1 | 3 | 6;
  onQtyChange: (q: 1 | 3 | 6) => void;
  aspect: "1:1" | "3:2" | "16:9";
  onAspectChange: (a: "1:1" | "3:2" | "16:9") => void;
  styleSel: string;
  onStyleChange: (s: string) => void;
  moreOpen: boolean;
  onMoreToggle: () => void;
  totalCost: string;
  generating: boolean;
  onGenerate: () => void;
  disabled: boolean;
}) {
  return (
    <aside className="studio-rail">
      <div className="rail-card">
        <div className="rail-card__head">
          <h3 className="rail-card__title">Generar variantes</h3>
          <button type="button" className="jm-btn jm-btn--xs jm-btn-tone-teal">
            <Icon name="wand" size={10} /> Sugerir
          </button>
        </div>

        <div className="kv">
          <span className="kv__label">Prompt</span>
          <textarea
            className="prompt-box"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
        </div>

        <div className="kv">
          <span className="kv__label">Modelo</span>
          <select
            className="model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} · {p.cost}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={"more-opts-btn" + (moreOpen ? " more-opts-btn--open" : "")}
          onClick={onMoreToggle}
        >
          <Icon name="chevron" size={10} />
          Opciones avanzadas
        </button>

        {moreOpen && (
          <div className="more-opts">
            <div className="kv">
              <span className="kv__label">Cantidad</span>
              <div className="qty-group">
                {[1, 3, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={
                      "qty-group__btn" + (qty === n ? " qty-group__btn--active" : "")
                    }
                    onClick={() => onQtyChange(n as 1 | 3 | 6)}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="kv">
              <span className="kv__label">Aspecto</span>
              <div className="ar-seg">
                {(["1:1", "3:2", "16:9"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={
                      "ar-seg__btn" + (aspect === a ? " ar-seg__btn--active" : "")
                    }
                    onClick={() => onAspectChange(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="kv" style={{ gridColumn: "1 / -1" }}>
              <span className="kv__label">Estilo</span>
              <div className="style-chips">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={
                      "style-chip" + (styleSel === s ? " style-chip--active" : "")
                    }
                    onClick={() => onStyleChange(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="gen-row">
          <span className="gen-row__total">
            ≈ <b>${totalCost}</b>
          </span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="jm-btn jm-btn--primary"
            disabled={disabled || generating}
            onClick={onGenerate}
          >
            <Icon name="bolt" size={12} />{" "}
            {generating ? `Generando ${qty}…` : `Generar ${qty}`}
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Variants block ──────────────────────────────────────── */
function VariantsBlock({
  variants,
  chosenIdx,
  onChooseVariant,
  onConfirm,
}: {
  variants: VariantResult[];
  chosenIdx: number | null;
  onChooseVariant: (idx: number) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="variants-block">
      <div className="variants-block__head">
        <h3 className="variants-block__title">Variantes por revisar</h3>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="jm-btn jm-btn--sm jm-btn--primary"
          disabled={chosenIdx == null}
          onClick={onConfirm}
        >
          <Icon name="check" size={11} /> Confirmar
        </button>
      </div>
      <div className="variants-grid">
        {variants.map((v, i) => {
          const isChosen = chosenIdx === i;
          return (
            <article
              key={`${v.variant}-${i}`}
              className={"variant-card" + (isChosen ? " variant-card--chosen" : "")}
              onClick={() => v.url && onChooseVariant(i)}
            >
              <div
                className="variant-card__img"
                style={
                  v.url
                    ? { backgroundImage: `url(${v.url})` }
                    : { background: "linear-gradient(135deg, #2a1a1a, #3a2020)" }
                }
              >
                {isChosen && (
                  <span className="variant-card__chosen-pin">
                    <Icon name="check" size={10} /> elegida
                  </span>
                )}
              </div>
              <div className="variant-card__body">
                <span className="variant-card__mood">
                  {VARIANT_MOOD[v.variant]}
                  {v.error ? ` · error` : ""}
                </span>
                <div className="variant-card__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (v.url) window.open(v.url, "_blank");
                    }}
                    title="Ver grande"
                  >
                    <Icon name="eye" size={11} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
