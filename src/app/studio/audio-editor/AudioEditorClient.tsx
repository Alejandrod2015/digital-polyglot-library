"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { getIsoLanguageTag } from "@/lib/languageFlags";

type StoryWordToken = {
  text: string;
  charStart: number;
  charEnd: number;
  startSec: number | null;
  endSec: number | null;
};

type AudioEditorBlock = {
  index: number;
  speakerLabel: string;
  voiceId: string | null;
  startChar: number;
  endChar: number;
};

type EligibleStory = {
  id: string;
  slug: string;
  title: string;
  language: string;
  journeyTitle: string | null;
  audioUrl: string;
  audioDurationSec: number | null;
  voiceId: string | null;
  ambientTag: string | null;
  wordCount: number;
  hasPendingPreview: boolean;
  audioUrlPreview: string | null;
};

type StoryDetail = EligibleStory & {
  words: StoryWordToken[];
  storyPlainText: string;
  blocks: AudioEditorBlock[];
  titleEndSec: number | null;
  narratorVoiceId: string | null;
  isMultiVoice: boolean;
};

const ACCENT = "#fcd34d";
const ACCENT_SOFT = "rgba(252, 211, 77, 0.14)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const DANGER = "#ef4444";
const SUCCESS = "#22c55e";

// Stable color palette for speaker badges. Cycles by speaker name.
const SPEAKER_COLORS = [
  "#fcd34d", // gold (narrator default)
  "#60a5fa", // blue
  "#f472b6", // pink
  "#34d399", // emerald
  "#a78bfa", // violet
  "#fb923c", // orange
  "#22d3ee", // cyan
];
function speakerColor(label: string, index: number): string {
  if (label === "narrator") return SPEAKER_COLORS[0];
  return SPEAKER_COLORS[(index % (SPEAKER_COLORS.length - 1)) + 1];
}

export default function AudioEditorClient() {
  const [stories, setStories] = useState<EligibleStory[] | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/stories");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { stories: EligibleStory[] };
      setStories(json.stories);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error cargando historias");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/studio/audio-editor/stories?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { story: StoryDetail };
      setDetail(json.story);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Error cargando historia");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const filteredStories = useMemo(() => {
    if (!stories) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.language.toLowerCase().includes(q) ||
        (s.journeyTitle ?? "").toLowerCase().includes(q),
    );
  }, [stories, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Row 1: Story picker (full width, compact) ── */}
      <aside
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Filtrar historias por título, slug, idioma..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "8px 12px",
              background: "rgba(0,0,0,0.25)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 6,
              color: "var(--foreground)",
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {filteredStories?.length ?? 0}
            {stories && filteredStories && stories.length !== filteredStories.length
              ? ` / ${stories.length}`
              : ""}
          </span>
          <button
            type="button"
            onClick={loadStories}
            disabled={loadingList}
            style={{
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 6,
              border: `1px solid ${CARD_BORDER}`,
              background: "transparent",
              color: "var(--muted)",
              cursor: loadingList ? "wait" : "pointer",
            }}
          >
            {loadingList ? "..." : "Refrescar"}
          </button>
        </div>
        {listError && (
          <div style={{ color: DANGER, fontSize: 12 }}>Error: {listError}</div>
        )}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            maxHeight: 132,
            overflowY: "auto",
          }}
        >
          {filteredStories?.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 12, padding: 8 }}>
              No hay historias que coincidan.
            </div>
          )}
          {filteredStories?.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                title={`${s.language} · ${s.wordCount}w${s.ambientTag ? ` · amb: ${s.ambientTag}` : ""}`}
                style={{
                  textAlign: "left",
                  background: active ? ACCENT_SOFT : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? ACCENT : CARD_BORDER}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  cursor: "pointer",
                  color: active ? ACCENT : "var(--foreground)",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span>{s.title}</span>
                <span style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7 }}>
                  · {getIsoLanguageTag(s.language)}
                </span>
                {s.hasPendingPreview && (
                  <span
                    title="Preview pendiente"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#eab308",
                      boxShadow: "0 0 6px rgba(234, 179, 8, 0.55)",
                      display: "inline-block",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Editor ── */}
      <section
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: 20,
          minHeight: 480,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {!selectedId && (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: 40, textAlign: "center" }}>
            Selecciona una historia para empezar a editar.
          </div>
        )}
        {selectedId && loadingDetail && (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>Cargando audio + word timings...</div>
        )}
        {selectedId && detailError && (
          <div style={{ color: DANGER, fontSize: 14 }}>Error: {detailError}</div>
        )}
        {detail && <EditorPanel detail={detail} onChanged={() => loadDetail(detail.id)} />}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function EditorPanel({ detail, onChanged }: { detail: StoryDetail; onChanged: () => void }) {
  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Manual noise-cut region: a free time span drag-selected on the waveform
  // (independent of word boundaries, since noises sit between/inside words).
  const [cutRegion, setCutRegion] = useState<{ start: number; end: number } | null>(null);

  // Active playback range: when the user clicked a per-row Play button
  // (block, title or selection), the player is "constrained" to a region
  // and auto-pauses at `stopAt`. We keep the key in state for UI (so the
  // row's button can show a pause icon while its range is active) and
  // mirror stopAt in a ref so the timeupdate listener can read it
  // without re-binding on every render.
  const [activeRangeKey, setActiveRangeKey] = useState<string | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const activeRangeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    activeRangeKeyRef.current = activeRangeKey;
  }, [activeRangeKey]);

  // Route the R2 audio through a same-origin proxy. WaveSurfer fetches the
  // file to decode it for the waveform, and that fetch is CORS-gated — the
  // R2 bucket's allowlist does not include the canonical `www.` host the
  // Studio runs on, so a direct fetch silently fails (empty waveform, 0:00).
  // The proxy resolves the URL from the DB by id (no SSRF) and streams it
  // back same-origin. `f` is a cache-buster derived from the real filename
  // so a regenerated preview (new filename) forces wavesurfer to reload.
  const realSourceUrl = detail.audioUrlPreview ?? detail.audioUrl;
  const sourceVariant = detail.audioUrlPreview ? "preview" : "master";
  const sourceBust = realSourceUrl ? realSourceUrl.split("/").pop() ?? "" : "";
  const sourceUrl = `/api/studio/audio-editor/audio?id=${encodeURIComponent(
    detail.id,
  )}&v=${sourceVariant}&f=${encodeURIComponent(sourceBust)}`;

  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);

  const [busyAction, setBusyAction] = useState<
    null | "preview" | "title" | "promote" | "discard" | "realign" | "cut"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Title state: tracks pending edit between regen and promote.
  const [titleDraft, setTitleDraft] = useState(detail.title);
  const [titlePromotePending, setTitlePromotePending] = useState(false);
  useEffect(() => {
    setTitleDraft(detail.title);
    setTitlePromotePending(false);
  }, [detail.id, detail.title]);

  const wordsWithTimings = useMemo(
    () =>
      detail.words.map((w, i) => ({
        ...w,
        index: i,
        hasTime: typeof w.startSec === "number" && typeof w.endSec === "number",
      })),
    [detail.words],
  );

  /* ── Init wavesurfer when source changes ── */
  useEffect(() => {
    if (!waveContainerRef.current) return;
    if (waveRef.current) {
      waveRef.current.destroy();
      waveRef.current = null;
    }
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setLoadError(null);
    setCutRegion(null);

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: "rgba(252, 211, 77, 0.35)",
      progressColor: ACCENT,
      cursorColor: "#ffffff",
      cursorWidth: 1,
      height: 96,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      url: sourceUrl,
    });
    waveRef.current = ws;

    // Regions plugin: drag on the waveform to mark a noise span to cut.
    // Only one region lives at a time — creating a new one replaces it.
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;
    regions.enableDragSelection({ color: "rgba(239, 68, 68, 0.25)" });
    const syncRegion = (region: { start: number; end: number }) =>
      setCutRegion({ start: region.start, end: region.end });
    regions.on("region-created", (region) => {
      for (const r of regions.getRegions()) {
        if (r.id !== region.id) r.remove();
      }
      syncRegion(region);
    });
    regions.on("region-updated", syncRegion);

    ws.on("ready", () => {
      setIsReady(true);
      setLoadError(null);
      setDuration(ws.getDuration());
    });
    // Surface load/decode failures instead of leaving an empty 0:00 player.
    ws.on("error", (err) => {
      setIsReady(false);
      setLoadError(
        err instanceof Error ? err.message : "No se pudo cargar el audio",
      );
    });
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      stopAtRef.current = null;
      setActiveRangeKey(null);
    });
    ws.on("timeupdate", (t) => {
      setCurrentTime(t);
      // When playback enters a constrained range, auto-pause exactly at
      // `stopAt`. We keep activeRangeKey so the row's icon stays in
      // "play to resume" state — user can click again to replay from
      // start (handled in playRangeToggle).
      if (stopAtRef.current !== null && t >= stopAtRef.current) {
        ws.pause();
      }
    });
    // Any direct interaction with the waveform (click/seek/drag) breaks
    // out of the constrained range so the user can scrub freely.
    ws.on("interaction", () => {
      stopAtRef.current = null;
      setActiveRangeKey(null);
    });

    return () => {
      ws.destroy();
      waveRef.current = null;
      regionsRef.current = null;
    };
  }, [sourceUrl]);

  /* ── Skip helpers ── */
  const seekBy = (deltaSec: number) => {
    const ws = waveRef.current;
    if (!ws) return;
    const next = Math.max(0, Math.min(duration || 0, ws.getCurrentTime() + deltaSec));
    ws.setTime(next);
  };
  const seekTo = (sec: number) => {
    const ws = waveRef.current;
    if (!ws) return;
    const next = Math.max(0, Math.min(duration || 0, sec));
    ws.setTime(next);
  };

  /* ── Selection ── */
  const selection = useMemo(() => {
    if (startIdx === null || endIdx === null) return null;
    const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const startWord = wordsWithTimings[lo];
    const endWord = wordsWithTimings[hi];
    if (!startWord?.hasTime || !endWord?.hasTime) return null;
    return {
      startIdx: lo,
      endIdx: hi,
      startSec: startWord.startSec as number,
      endSec: endWord.endSec as number,
      charStart: startWord.charStart,
      charEnd: endWord.charEnd,
      text: detail.storyPlainText.slice(startWord.charStart, endWord.charEnd),
      wordCount: hi - lo + 1,
    };
  }, [startIdx, endIdx, wordsWithTimings, detail.storyPlainText]);

  // Determine the block the selection lives inside (for showing the voice).
  const selectionBlock = useMemo(() => {
    if (!selection) return null;
    return detail.blocks.find(
      (b) => selection.charStart >= b.startChar && selection.charEnd <= b.endChar,
    );
  }, [selection, detail.blocks]);
  const selectionCrossesBlocks = selection && !selectionBlock;

  const handleWordClick = (idx: number) => {
    if (startIdx === null || (startIdx !== null && endIdx !== null)) {
      setStartIdx(idx);
      setEndIdx(null);
    } else {
      setEndIdx(idx);
    }
  };

  const clearSelection = () => {
    setStartIdx(null);
    setEndIdx(null);
  };

  /**
   * Play a labelled [startSec, stopAt) range with toggle semantics:
   *   - If this range is already active and playing → pause.
   *   - If active but paused → resume (or replay from `startSec` when
   *     the play head sits at/after stopAt).
   *   - Else → set new range and play from `startSec`.
   *
   * `key` is any string that uniquely identifies the range (e.g.
   * "block-3", "title", "selection"). The same key is reused by the
   * row's button to render a pause glyph while active.
   */
  const playRangeToggle = (key: string, startSec: number, stopAt: number) => {
    const ws = waveRef.current;
    if (!ws) return;
    const safeStop = Math.max(startSec + 0.05, stopAt);
    const sameRange = activeRangeKeyRef.current === key;
    if (sameRange) {
      if (ws.isPlaying()) {
        ws.pause();
      } else {
        // Replay from the start if the cursor is past stopAt; otherwise
        // resume from wherever the previous pause left off.
        const t = ws.getCurrentTime();
        if (t < startSec - 0.05 || t >= safeStop - 0.01) {
          ws.setTime(startSec);
        }
        stopAtRef.current = safeStop;
        ws.play();
      }
      return;
    }
    stopAtRef.current = safeStop;
    setActiveRangeKey(key);
    activeRangeKeyRef.current = key;
    ws.setTime(startSec);
    ws.play();
  };

  /**
   * Stop point for a clip that ends right where the next block begins.
   * Uses the midpoint of the inter-block silence so we capture the tail
   * of the current block without bleeding into the next speaker's first
   * word. Falls back to `endSec + 0.2` when no next start is known.
   */
  const midpointStop = (endSec: number, nextStartSec: number | null): number => {
    if (nextStartSec === null) return endSec + 0.2;
    const gap = nextStartSec - endSec;
    if (gap <= 0) return endSec; // overlapping (drift) — stop right at endSec
    return endSec + Math.min(0.2, gap / 2);
  };

  const playSelection = () => {
    if (!selection) return;
    playRangeToggle("selection", selection.startSec, selection.endSec + 0.05);
  };

  /* ── Actions ── */
  const regenerateSegment = async () => {
    if (!selection || !selectionBlock) return;
    setBusyAction("preview");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/preview-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: detail.id,
          startSec: selection.startSec,
          endSec: selection.endSec,
          charStart: selection.charStart,
          charEnd: selection.charEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
      clearSelection();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error generando preview");
    } finally {
      setBusyAction(null);
    }
  };

  /**
   * Regenerate the entire body of a block, using its current text (we
   * don't allow inline editing of body block text — title is the only
   * editable block). Useful when an entire speaker turn has a glitch.
   */
  const regenerateBlock = async (blockIdx: number) => {
    const block = detail.blocks[blockIdx];
    if (!block) return;
    const blockWords = wordsWithTimings.filter(
      (w) => w.hasTime && w.charStart >= block.startChar && w.charEnd <= block.endChar,
    );
    if (blockWords.length === 0) return;
    const first = blockWords[0];
    const last = blockWords[blockWords.length - 1];
    setBusyAction("preview");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/preview-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: detail.id,
          startSec: first.startSec as number,
          endSec: last.endSec as number,
          charStart: first.charStart,
          charEnd: last.charEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error regenerando bloque");
    } finally {
      setBusyAction(null);
    }
  };

  const regenerateTitle = async () => {
    if (!titleDraft.trim()) return;
    setBusyAction("title");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/preview-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, newTitle: titleDraft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setTitlePromotePending(true);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error regenerando título");
    } finally {
      setBusyAction(null);
    }
  };

  const promote = async () => {
    setBusyAction("promote");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: detail.id,
          ...(titlePromotePending ? { newTitle: titleDraft.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error promoviendo preview");
    } finally {
      setBusyAction(null);
    }
  };

  const realignTimings = async () => {
    if (!confirm("Re-correr aeneas para refrescar los word timings? Esto puede tardar ~20-40s.")) return;
    setBusyAction("realign");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/realign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error re-alineando");
    } finally {
      setBusyAction(null);
    }
  };

  const discard = async () => {
    if (!confirm("¿Descartar el preview y volver al master original?")) return;
    setBusyAction("discard");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setTitlePromotePending(false);
      setTitleDraft(detail.title);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error descartando preview");
    } finally {
      setBusyAction(null);
    }
  };

  /* ── Manual noise cut (waveform region) ── */
  const playCutRegion = () => {
    if (!cutRegion) return;
    playRangeToggle("cut-region", cutRegion.start, cutRegion.end + 0.02);
  };

  const clearCutRegion = () => {
    regionsRef.current?.clearRegions();
    setCutRegion(null);
  };

  const cutNoiseRegion = async () => {
    if (!cutRegion) return;
    if (
      !confirm(
        `¿Cortar el tramo ${formatTime(cutRegion.start)} → ${formatTime(cutRegion.end)} (${(
          cutRegion.end - cutRegion.start
        ).toFixed(2)}s)? Se elimina del audio y se une con un crossfade. Crea un preview; el master no cambia hasta "Guardar".`,
      )
    ) {
      return;
    }
    setBusyAction("cut");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: detail.id,
          startSec: cutRegion.start,
          endSec: cutRegion.end,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setCutRegion(null);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error cortando el tramo");
    } finally {
      setBusyAction(null);
    }
  };

  /* ── Group words by block for organized rendering ── */
  const wordsByBlock = useMemo(() => {
    const grouped: Array<{ block: AudioEditorBlock; words: typeof wordsWithTimings }> = detail.blocks.map(
      (block) => ({ block, words: [] }),
    );
    for (const w of wordsWithTimings) {
      const blockIdx = detail.blocks.findIndex(
        (b) => w.charStart >= b.startChar && w.charEnd <= b.endChar,
      );
      if (blockIdx >= 0) grouped[blockIdx].words.push(w);
    }
    return grouped;
  }, [detail.blocks, wordsWithTimings]);

  // Unique speaker labels (in order of first appearance) for consistent
  // color assignment across all rows of the same character.
  const speakerColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    let next = 0;
    for (const block of detail.blocks) {
      if (!map.has(block.speakerLabel)) {
        map.set(block.speakerLabel, next);
        next++;
      }
    }
    return map;
  }, [detail.blocks]);

  const playTitle = () => {
    if (detail.titleEndSec === null) return;
    // detail.titleEndSec = startSec of the first body word. We don't
    // know exactly when the title's last spoken syllable ends — there's
    // silence between title and body. Park the stop at titleEndSec - 0.1
    // so we capture the title fully without bleeding into "Es" (etc).
    const stop = Math.max(0.5, detail.titleEndSec - 0.1);
    playRangeToggle("title", 0, stop);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Story metadata header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
            {detail.title}
          </h2>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {detail.language} · {detail.words.length} palabras
            {detail.ambientTag ? ` · ambient: ${detail.ambientTag}` : " · sin ambient"}
            {detail.isMultiVoice
              ? ` · multi-voz (${detail.blocks.length} bloques)`
              : detail.voiceId
                ? ` · voice: ${detail.voiceId}`
                : detail.narratorVoiceId
                  ? ` · voice: ${detail.narratorVoiceId}`
                  : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={realignTimings}
          disabled={busyAction !== null}
          title="Re-corre aeneas para refrescar los word timings (útil si ves nombres de personajes al final de los bloques)"
          style={{
            ...btnStyle("ghost", busyAction !== null),
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RegenIcon size={12} />
          <span>{busyAction === "realign" ? "Re-alineando..." : "Re-alinear timings"}</span>
        </button>
      </div>

      {/* ── Preview indicator ── */}
      {detail.audioUrlPreview && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 6,
            background: "rgba(234, 179, 8, 0.15)",
            color: "#eab308",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            alignSelf: "flex-start",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#eab308",
              boxShadow: "0 0 8px rgba(234, 179, 8, 0.65)",
            }}
          />
          PREVIEW PENDIENTE (reproducción usa preview, no master)
        </div>
      )}

      {/* ── Waveform + transport ── */}
      <div
        style={{
          background: "rgba(0,0,0,0.25)",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 8,
          padding: 12,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div ref={waveContainerRef} style={{ width: "100%", minWidth: 0 }} />
        {loadError && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(239, 68, 68, 0.12)",
              border: `1px solid ${DANGER}`,
              color: DANGER,
              fontSize: 12,
            }}
          >
            No se pudo cargar el audio: {loadError}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <TransportButton
            disabled={!isReady}
            onClick={() => seekBy(-10)}
            label="10s"
            icon={<SkipBackIcon />}
            iconLeft
            title="Atrasar 10s"
          />
          <TransportButton
            disabled={!isReady}
            onClick={() => seekBy(-5)}
            label="5s"
            icon={<SkipBackIcon />}
            iconLeft
            title="Atrasar 5s"
          />
          <button
            type="button"
            disabled={!isReady}
            onClick={() => {
              // Transport play/pause is "free" mode — clear any active
              // constrained range so playback continues past the previous
              // block's stopAt.
              stopAtRef.current = null;
              setActiveRangeKey(null);
              waveRef.current?.playPause();
            }}
            aria-label={isPlaying ? "Pausar" : "Reproducir"}
            title={isPlaying ? "Pausar" : "Reproducir"}
            style={{
              ...btnStyle(isPlaying ? "secondary" : "primary", !isReady),
              width: 38,
              height: 32,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </button>
          <TransportButton
            disabled={!isReady}
            onClick={() => seekBy(5)}
            label="5s"
            icon={<SkipForwardIcon />}
            iconLeft={false}
            title="Adelantar 5s"
          />
          <TransportButton
            disabled={!isReady}
            onClick={() => seekBy(10)}
            label="10s"
            icon={<SkipForwardIcon />}
            iconLeft={false}
            title="Adelantar 10s"
          />
          <span
            style={{ fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums", marginLeft: 6 }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* ── Manual noise cut (waveform region) ── */}
      <div
        style={{
          background: cutRegion ? "rgba(239, 68, 68, 0.10)" : "transparent",
          border: `1px solid ${cutRegion ? DANGER : CARD_BORDER}`,
          borderRadius: 8,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: cutRegion ? DANGER : "var(--muted)" }}>
          {cutRegion
            ? `Tramo a cortar: ${formatTime(cutRegion.start)} → ${formatTime(cutRegion.end)} (${(
                cutRegion.end - cutRegion.start
              ).toFixed(2)}s)`
            : "Cortar ruido manual: arrastra sobre la onda para marcar el tramo (un clic, pop o respiración) y córtalo."}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!cutRegion}
            onClick={playCutRegion}
            style={{
              ...btnStyle("secondary", !cutRegion),
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {activeRangeKey === "cut-region" && isPlaying ? (
              <>
                <PauseIcon /> Pausar tramo
              </>
            ) : (
              <>
                <PlayIcon /> Reproducir tramo
              </>
            )}
          </button>
          <button
            type="button"
            disabled={!cutRegion}
            onClick={clearCutRegion}
            style={btnStyle("ghost", !cutRegion)}
          >
            Limpiar
          </button>
          <button
            type="button"
            disabled={!cutRegion || busyAction !== null}
            onClick={cutNoiseRegion}
            style={{
              ...btnStyle("primary", !cutRegion || busyAction !== null),
              background: cutRegion && busyAction === null ? DANGER : undefined,
              borderColor: cutRegion && busyAction === null ? DANGER : undefined,
            }}
          >
            {busyAction === "cut" ? "Cortando..." : "Cortar este tramo"}
          </button>
        </div>
      </div>

      {/* ── Selection bar ── */}
      <div
        style={{
          background: selection ? ACCENT_SOFT : "transparent",
          border: `1px solid ${selection ? ACCENT : CARD_BORDER}`,
          borderRadius: 8,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: selection ? ACCENT : "var(--muted)" }}>
          {selection
            ? `Selección: ${formatTime(selection.startSec)} → ${formatTime(selection.endSec)} (${selection.wordCount} palabras)${
                selectionBlock ? ` · voz: ${selectionBlock.speakerLabel}` : ""
              }`
            : startIdx === null
              ? "Click en la PRIMERA palabra del tramo a reemplazar, luego en la ÚLTIMA."
              : "Ahora click en la ÚLTIMA palabra del tramo."}
        </div>
        {selectionCrossesBlocks && (
          <div style={{ fontSize: 12, color: DANGER }}>
            La selección cruza un cambio de personaje. Limita la selección a un solo bloque.
          </div>
        )}
        {selection && (
          <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4, fontStyle: "italic" }}>
            “{selection.text}”
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!selection}
            onClick={playSelection}
            style={{
              ...btnStyle("secondary", !selection),
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {activeRangeKey === "selection" && isPlaying ? (
              <>
                <PauseIcon /> Pausar selección
              </>
            ) : (
              <>
                <PlayIcon /> Reproducir selección
              </>
            )}
          </button>
          <button
            type="button"
            disabled={!selection}
            onClick={clearSelection}
            style={btnStyle("ghost", !selection)}
          >
            Limpiar
          </button>
          <button
            type="button"
            disabled={!selection || !selectionBlock || busyAction !== null}
            onClick={regenerateSegment}
            style={btnStyle(
              "primary",
              !selection || !selectionBlock || busyAction !== null,
            )}
          >
            {busyAction === "preview" ? "Regenerando..." : "Regenerar este tramo"}
          </button>
        </div>
      </div>

      {/* ── Preview actions ── */}
      {detail.audioUrlPreview && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: "#eab308", flex: 1, minWidth: 200 }}>
            {titlePromotePending
              ? "Hay un preview con título nuevo. Al guardar se aplica también al campo `title`."
              : "Hay un preview spliceado. Escúchalo y decide."}
          </div>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={promote}
            style={{
              ...btnStyle("primary", busyAction !== null),
              background: SUCCESS,
              borderColor: SUCCESS,
            }}
          >
            {busyAction === "promote" ? "Promoviendo..." : "Guardar (reemplaza master + re-alinea)"}
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={discard}
            style={{
              ...btnStyle("secondary", busyAction !== null),
              borderColor: DANGER,
              color: DANGER,
            }}
          >
            Descartar preview
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ color: DANGER, fontSize: 13 }}>Error: {actionError}</div>
      )}

      {/* ── Words organized by speaker block ── */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>BLOQUES DEL AUDIO (click para seleccionar tramo)</span>
          <span style={{ fontWeight: 400 }}>
            título + {detail.blocks.length} bloque{detail.blocks.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div
          style={{
            background: "rgba(0,0,0,0.18)",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 8,
            padding: 12,
            maxHeight: 520,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* ── Title pseudo-block (always first, editable text) ── */}
          {detail.titleEndSec !== null && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "92px minmax(0, 1fr) auto",
                gap: 12,
                paddingBottom: 10,
                borderBottom: `1px dashed ${CARD_BORDER}`,
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    background: `${ACCENT}22`,
                    border: `1px solid ${ACCENT}55`,
                    color: ACCENT,
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    textAlign: "left",
                    width: "fit-content",
                  }}
                >
                  título
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  0:00 → {formatTime(detail.titleEndSec)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Texto del título narrado..."
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.30)",
                    border: `1px solid ${titleDraft.trim() !== detail.title ? ACCENT : CARD_BORDER}`,
                    borderRadius: 6,
                    color: "var(--foreground)",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
                {titleDraft.trim() !== detail.title && (
                  <button
                    type="button"
                    onClick={() => setTitleDraft(detail.title)}
                    style={{
                      alignSelf: "flex-start",
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      fontSize: 10,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    revertir
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {(() => {
                  const titleActive = activeRangeKey === "title";
                  const showPause = titleActive && isPlaying;
                  return (
                    <IconButton
                      icon={showPause ? "pause" : "play"}
                      title={showPause ? "Pausar título" : "Escuchar título"}
                      active={titleActive}
                      onClick={playTitle}
                    />
                  );
                })()}
                <IconButton
                  icon="regen"
                  title={
                    busyAction === "title"
                      ? "Regenerando título..."
                      : titleDraft.trim() === detail.title
                        ? "Regenerar con el mismo texto (otra toma de TTS)"
                        : "Regenerar título con el texto nuevo"
                  }
                  disabled={busyAction !== null || !titleDraft.trim()}
                  onClick={regenerateTitle}
                />
              </div>
            </div>
          )}
          {wordsByBlock.map(({ block, words }, idx) => {
            if (words.length === 0) return null;
            const colorIdx = speakerColorIndex.get(block.speakerLabel) ?? 0;
            const color = speakerColor(block.speakerLabel, colorIdx);
            const firstTimed = words.find((w) => w.hasTime);
            const lastTimed = [...words].reverse().find((w) => w.hasTime);
            const blockStart = firstTimed?.startSec ?? null;
            const blockEnd = lastTimed?.endSec ?? null;
            // Next block's first timed word — used as a hard ceiling for
            // playback so we don't bleed into the next speaker's audio.
            let nextStart: number | null = null;
            for (let j = idx + 1; j < wordsByBlock.length; j++) {
              const nextFirst = wordsByBlock[j].words.find((w) => w.hasTime);
              if (nextFirst) {
                nextStart = nextFirst.startSec ?? null;
                break;
              }
            }
            const canPlay = blockStart !== null && blockEnd !== null;
            const canRegen = canPlay && busyAction === null;
            return (
              <div
                key={block.index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "92px minmax(0, 1fr) auto",
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom:
                    idx === wordsByBlock.length - 1 ? "none" : `1px dashed ${CARD_BORDER}`,
                  alignItems: "start",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => blockStart !== null && seekTo(blockStart)}
                    title={blockStart !== null ? `Saltar a ${formatTime(blockStart)}` : ""}
                    style={{
                      background: `${color}22`,
                      border: `1px solid ${color}55`,
                      color,
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      cursor: blockStart !== null ? "pointer" : "default",
                      textAlign: "left",
                      width: "fit-content",
                    }}
                  >
                    {block.speakerLabel}
                  </button>
                  {blockStart !== null && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatTime(blockStart)}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.75,
                    wordBreak: "break-word",
                  }}
                >
                  {words.map((w) => {
                    const inSelection =
                      selection && w.index >= selection.startIdx && w.index <= selection.endIdx;
                    const isStartAnchor = startIdx === w.index && endIdx === null;
                    const playing =
                      w.hasTime &&
                      currentTime >= (w.startSec ?? 0) &&
                      currentTime < (w.endSec ?? 0);
                    return (
                      <span
                        key={w.index}
                        onClick={() => w.hasTime && handleWordClick(w.index)}
                        title={
                          w.hasTime
                            ? `${(w.startSec as number).toFixed(2)}s → ${(w.endSec as number).toFixed(2)}s`
                            : "sin timing"
                        }
                        style={{
                          cursor: w.hasTime ? "pointer" : "not-allowed",
                          padding: "2px 4px",
                          marginRight: 2,
                          borderRadius: 3,
                          background: inSelection
                            ? ACCENT_SOFT
                            : isStartAnchor
                              ? "rgba(34, 197, 94, 0.22)"
                              : playing
                                ? "rgba(255,255,255,0.10)"
                                : "transparent",
                          color: inSelection
                            ? ACCENT
                            : w.hasTime
                              ? "var(--foreground)"
                              : "var(--muted)",
                          opacity: w.hasTime ? 1 : 0.4,
                          textDecoration: w.hasTime ? "none" : "line-through",
                          borderBottom: isStartAnchor ? `2px solid ${SUCCESS}` : "2px solid transparent",
                        }}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {(() => {
                    const blockKey = `block-${block.index}`;
                    const blockActive = activeRangeKey === blockKey;
                    const showPause = blockActive && isPlaying;
                    return (
                      <IconButton
                        icon={showPause ? "pause" : "play"}
                        title={
                          showPause
                            ? "Pausar bloque"
                            : blockActive
                              ? "Reanudar bloque"
                              : "Escuchar este bloque"
                        }
                        disabled={!canPlay}
                        active={blockActive}
                        onClick={() =>
                          canPlay &&
                          playRangeToggle(
                            blockKey,
                            blockStart as number,
                            midpointStop(blockEnd as number, nextStart),
                          )
                        }
                      />
                    );
                  })()}
                  <IconButton
                    icon="regen"
                    title={
                      !canRegen
                        ? "No disponible"
                        : busyAction === "preview"
                          ? "Regenerando..."
                          : "Regenerar todo este bloque con su texto actual"
                    }
                    disabled={!canRegen}
                    onClick={() => regenerateBlock(idx)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          opacity: 0.7,
          borderTop: `1px solid ${CARD_BORDER}`,
          paddingTop: 10,
        }}
      >
        BETA: el splice usa el mismo ambient tag al volumen del master + crossfade de 80ms. En multi-voz cada
        bloque usa su propia voz (resolución por `dialogueSpec`). Al guardar se re-corre aeneas para
        re-alinear word timings. Nota: editar el título solo actualiza `story.title`, NO el texto narrativo
        embebido en `dialogueSpec[0]`.
      </div>
    </div>
  );
}

function btnStyle(
  variant: "primary" | "secondary" | "ghost",
  disabled?: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "opacity 0.15s",
    opacity: disabled ? 0.4 : 1,
  };
  if (variant === "primary") {
    return {
      ...base,
      background: ACCENT,
      color: "#0a1628",
      border: `1px solid ${ACCENT}`,
    };
  }
  if (variant === "secondary") {
    return {
      ...base,
      background: "transparent",
      color: "var(--foreground)",
      border: `1px solid ${CARD_BORDER}`,
    };
  }
  return {
    ...base,
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid transparent",
  };
}

/** Inline SVG icons — flat, monochrome, no emojis. Each renders at 12px
 *  by default; pass `size` to override. */
function PlayIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 2.7v10.6a.6.6 0 0 0 .92.5l8.3-5.3a.6.6 0 0 0 0-1l-8.3-5.3a.6.6 0 0 0-.92.5z" />
    </svg>
  );
}
function PauseIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="4" y="3" width="2.8" height="10" rx="0.6" />
      <rect x="9.2" y="3" width="2.8" height="10" rx="0.6" />
    </svg>
  );
}
function RegenIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.5-3.8" />
      <polyline points="13.5 1.8 13.5 5 10.3 5" />
    </svg>
  );
}
function SkipBackIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M7.5 2.7v10.6a.6.6 0 0 1-.92.5L0.78 8.5a.6.6 0 0 1 0-1l5.8-3.8a.6.6 0 0 1 .92.5z" />
      <path d="M15.2 2.7v10.6a.6.6 0 0 1-.92.5l-5.8-5.3a.6.6 0 0 1 0-1l5.8-5.3a.6.6 0 0 1 .92.5z" />
    </svg>
  );
}
function SkipForwardIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8.5 2.7v10.6a.6.6 0 0 0 .92.5l5.8-5.3a.6.6 0 0 0 0-1L9.42 2.2a.6.6 0 0 0-.92.5z" />
      <path d="M0.8 2.7v10.6a.6.6 0 0 0 .92.5l5.8-5.3a.6.6 0 0 0 0-1L1.72 2.2a.6.6 0 0 0-.92.5z" />
    </svg>
  );
}

/** Compact button used by the transport bar (skip ±5s / ±10s). Icon on
 *  one side, numeric label on the other; quiet by default, brightens on
 *  hover. */
function TransportButton(props: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  iconLeft?: boolean;
  title?: string;
}) {
  const { disabled, onClick, label, icon, iconLeft = true, title } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        height: 32,
        padding: "0 10px",
        borderRadius: 6,
        background: "transparent",
        border: `1px solid ${CARD_BORDER}`,
        color: "var(--foreground)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 0.85,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        transition: "opacity 0.15s, color 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.borderColor = `${ACCENT}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = disabled ? "0.4" : "0.85";
        e.currentTarget.style.borderColor = CARD_BORDER;
      }}
    >
      {iconLeft && icon}
      <span>{label}</span>
      {!iconLeft && icon}
    </button>
  );
}

/** Subtle action icon used inside block rows. Low-opacity by default,
 *  brightens on hover. The action text is the title attribute so the
 *  button itself stays visually tiny. */
function IconButton(props: {
  icon: "play" | "pause" | "regen";
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  const { icon, title, disabled, active, onClick } = props;
  const glyph =
    icon === "play" ? <PlayIcon /> : icon === "pause" ? <PauseIcon /> : <RegenIcon />;
  const baseOpacity = active ? 1 : disabled ? 0.25 : 0.55;
  const baseColor = active ? ACCENT : "var(--muted)";
  const baseBorder = active ? `${ACCENT}66` : CARD_BORDER;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 26,
        height: 26,
        padding: 0,
        borderRadius: 6,
        background: active ? `${ACCENT}11` : "transparent",
        border: `1px solid ${baseBorder}`,
        color: baseColor,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: baseOpacity,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.15s, color 0.15s, border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.color = ACCENT;
        e.currentTarget.style.borderColor = `${ACCENT}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = String(baseOpacity);
        e.currentTarget.style.color = baseColor;
        e.currentTarget.style.borderColor = baseBorder;
      }}
    >
      {glyph}
    </button>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
