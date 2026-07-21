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
  voiceName: string | null;
  startChar: number;
  endChar: number;
  // Exact offsets from generation (ground truth). Null for stories
  // generated before fragment offsets were captured → fall back to the
  // word-timing-derived range.
  startSec: number | null;
  endSec: number | null;
  // This section's standalone audio file. When present the editor plays
  // it directly (exact, no bleed) instead of seeking inside the master.
  sectionUrl: string | null;
  // Previous take of this section (revert target), if any.
  prevSectionUrl: string | null;
  // Index into audioFragments for section replacement (null if no sections).
  fragmentIndex: number | null;
  // In-app ElevenLabs regenerate spend cap state for this segment.
  regensUsed: number;
  regenLimit: number;
  // Operator comment left on this segment, if any.
  comment: string | null;
};

type EligibleStory = {
  id: string;
  slug: string;
  title: string;
  level: string;
  topic: string;
  slotIndex: number;
  language: string;
  variant: string | null;
  journeyTitle: string | null;
  journeyTopics: string[];
  audioUrl: string;
  audioDurationSec: number | null;
  voiceId: string | null;
  ambientTag: string | null;
  wordCount: number;
  hasPendingPreview: boolean;
  audioUrlPreview: string | null;
  audioEditorNote: string | null;
};

type StoryDetail = EligibleStory & {
  words: StoryWordToken[];
  storyPlainText: string;
  blocks: AudioEditorBlock[];
  titleEndSec: number | null;
  titleSectionUrl: string | null;
  titlePrevSectionUrl: string | null;
  titleFragmentIndex: number | null;
  titleRegensUsed: number;
  regenLimit: number;
  titleComment: string | null;
  narratorVoiceId: string | null;
  narratorVoiceName: string | null;
  isMultiVoice: boolean;
  // False on Vercel (no system ffmpeg/ffprobe): per-segment regen/cut
  // disabled, manual full-audio upload used instead. True locally.
  serverCanSplice: boolean;
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

  // Group the picker by the actual journey; LANGUAGE + journey name
  // ("Español · Traveler", "Italiano · Traveler", "Alemán ·
  // Conversational"); so each journey is its own short list instead of
  // 49 stories of every language piled under one "Traveler" type.
  // Within a journey, stories follow their reading order (level → slot),
  // not alphabetical, so the operator works top-to-bottom like the
  // learner sees them.
  const LANG_LABEL: Record<string, string> = {
    spanish: "Español",
    italian: "Italiano",
    german: "Alemán",
    french: "Francés",
    portuguese: "Portugués",
    english: "Inglés",
  };
  // Region label from the journey `variant`. Falls back to the raw
  // variant uppercased so an unmapped value still shows something.
  const REGION_LABEL: Record<string, string> = {
    latam: "Latinoamérica",
    es: "España",
    spain: "España",
    mx: "México",
    ar: "Argentina",
    co: "Colombia",
    pe: "Perú",
    cl: "Chile",
    br: "Brasil",
    pt: "Portugal",
    it: "Italia",
    de: "Alemania",
    fr: "Francia",
  };
  const LEVEL_RANK: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3, c1: 4, c2: 5 };
  const groupedStories = useMemo(() => {
    if (!filteredStories) return null;
    const groups = new Map<string, EligibleStory[]>();
    for (const s of filteredStories) {
      const raw = s.language || "?";
      const lang = LANG_LABEL[s.language?.toLowerCase()] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
      const variant = (s.variant ?? "").toLowerCase();
      const region = variant ? REGION_LABEL[variant] ?? variant.toUpperCase() : null;
      const journey = (s.journeyTitle ?? "").trim() || "Sin journey";
      // e.g. "Español (Latinoamérica) · Traveler"
      const key = `${lang}${region ? ` (${region})` : ""} · ${journey}`;
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      // Topic order comes from the journey's own `topics[]` array (same
      // source the reader/journey page uses), so stories run in the real
      // curriculum order: level → topic → slot. Falls back to topic name.
      const topicOrder = new Map<string, number>();
      (list[0]?.journeyTopics ?? []).forEach((t, i) => topicOrder.set(t, i));
      list.sort((a, b) => {
        const la = LEVEL_RANK[a.level?.toLowerCase()] ?? 99;
        const lb = LEVEL_RANK[b.level?.toLowerCase()] ?? 99;
        if (la !== lb) return la - lb;
        const ta = topicOrder.has(a.topic) ? topicOrder.get(a.topic)! : Number.MAX_SAFE_INTEGER;
        const tb = topicOrder.has(b.topic) ? topicOrder.get(b.topic)! : Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
        if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
        return a.title.localeCompare(b.title);
      });
    }
    return [...groups.entries()].sort((a, b) => {
      const aNo = a[0].endsWith("Sin journey");
      const bNo = b[0].endsWith("Sin journey");
      if (aNo !== bNo) return aNo ? 1 : -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredStories]);

  const renderChip = (s: EligibleStory) => {
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
        {s.audioEditorNote && s.audioEditorNote.trim() && (
          <span title={`Nota: ${s.audioEditorNote}`} style={{ fontSize: 11, lineHeight: 1 }}>
            📝
          </span>
        )}
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
  };

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
            flexDirection: "column",
            gap: 10,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {groupedStories?.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 12, padding: 8 }}>
              No hay historias que coincidan.
            </div>
          )}
          {groupedStories?.map(([journeyName, group]) => (
            <div key={journeyName} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{journeyName}</span>
                <span style={{ opacity: 0.6, fontWeight: 500 }}>· {group.length}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {group.map(renderChip)}
              </div>
            </div>
          ))}
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
  // Dedicated player for SECTION files (the ground-truth standalone takes).
  // When a block has its own audio file we play THAT; exact, no bleed,
  // starts at the beginning; instead of seeking inside the master.
  const sectionAudioRef = useRef<HTMLAudioElement | null>(null);
  const [sectionPlayingKey, setSectionPlayingKey] = useState<string | null>(null);
  const playSection = (key: string, url: string) => {
    const a = sectionAudioRef.current;
    if (!a) return;
    // Stop the master player so we never hear both at once.
    waveRef.current?.pause();
    if (sectionPlayingKey === key && !a.paused) {
      a.pause();
      return;
    }
    if (a.src !== url) a.src = url;
    a.currentTime = 0;
    setSectionPlayingKey(key);
    void a.play().catch(() => setSectionPlayingKey(null));
  };
  // In-place section edits: regenerate/upload/revert update the affected
  // section's url WITHOUT reloading the editor (screen stays put). Keyed
  // by fragmentIndex; resets on story change.
  const [sectionState, setSectionState] = useState<Record<number, { url: string; prevUrl: string | null }>>({});
  useEffect(() => { setSectionState({}); }, [detail.id]);
  // Per-segment regenerate usage, kept locally so the "X/N" badge + the
  // disabled state update right after a regen without reloading the editor.
  // Keyed by fragmentIndex; resets on story change.
  const [regenState, setRegenState] = useState<Record<number, number>>({});
  useEffect(() => { setRegenState({}); }, [detail.id]);
  const regensUsedFor = (fragmentIndex: number | null, fallback: number): number =>
    fragmentIndex !== null && regenState[fragmentIndex] !== undefined ? regenState[fragmentIndex] : fallback;
  // Per-segment operator comments: which one's editor is open, the draft,
  // and locally-saved overrides so the indicator updates without reload.
  const [commentState, setCommentState] = useState<Record<number, string | null>>({});
  const [openComment, setOpenComment] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  useEffect(() => { setCommentState({}); setOpenComment(null); setCommentDraft(""); }, [detail.id]);
  const commentFor = (fragmentIndex: number | null, fallback: string | null): string | null =>
    fragmentIndex !== null && commentState[fragmentIndex] !== undefined ? commentState[fragmentIndex] : fallback;
  const toggleComment = (fragmentIndex: number, current: string | null) => {
    if (openComment === fragmentIndex) { setOpenComment(null); return; }
    setOpenComment(fragmentIndex);
    setCommentDraft(current ?? "");
  };
  const saveComment = async (fragmentIndex: number) => {
    setSavingComment(true);
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, fragmentIndex, comment: commentDraft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setCommentState((s) => ({ ...s, [fragmentIndex]: json.comment ?? null }));
      setOpenComment(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error guardando el comentario");
    } finally {
      setSavingComment(false);
    }
  };
  // The section currently being worked on + elapsed seconds, for the
  // in-row "Regenerando… Ns" progress indicator.
  const [busyFragment, setBusyFragment] = useState<{ index: number; action: "regen" | "upload" | "revert" } | null>(null);
  const [busyElapsed, setBusyElapsed] = useState(0);
  useEffect(() => {
    if (!busyFragment) { setBusyElapsed(0); return; }
    const t0 = Date.now();
    const id = window.setInterval(() => setBusyElapsed(Math.max(0, Math.round((Date.now() - t0) / 1000))), 500);
    return () => window.clearInterval(id);
  }, [busyFragment]);
  const sectionUrlFor = (b: AudioEditorBlock): string | null =>
    b.fragmentIndex !== null && sectionState[b.fragmentIndex] ? sectionState[b.fragmentIndex].url : b.sectionUrl;
  const prevUrlFor = (b: AudioEditorBlock): string | null =>
    b.fragmentIndex !== null && sectionState[b.fragmentIndex] ? sectionState[b.fragmentIndex].prevUrl : b.prevSectionUrl;
  const stopAtRef = useRef<number | null>(null);
  // Precise pause timer. `timeupdate` from the MediaElement backend only
  // fires ~4x/sec, so pausing from it overshoots by up to ~250ms and you
  // hear the start of the NEXT segment. We schedule an exact setTimeout
  // to pause at the boundary; the timeupdate check stays as a backstop.
  const stopTimerRef = useRef<number | null>(null);
  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);
  const activeRangeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    activeRangeKeyRef.current = activeRangeKey;
  }, [activeRangeKey]);

  // Route the R2 audio through a same-origin proxy. WaveSurfer fetches the
  // file to decode it for the waveform, and that fetch is CORS-gated; the
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
    null | "preview" | "title" | "promote" | "discard" | "realign" | "cut" | "upload" | "replace-master"
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // In-app confirm modal (replaces window.confirm so it matches the app's
  // look). confirmAsync resolves true/false when the user picks.
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const confirmAsync = useCallback(
    (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) =>
        setConfirmDialog({ confirmLabel: "Continuar", ...opts, resolve }),
      ),
    [],
  );
  // Hidden file input driving the manual fragment upload. `uploadTarget`
  // holds the [startSec, endSec] span the next picked file replaces; set
  // by either the selection bar or a per-block upload button right before
  // opening the picker.
  const fragmentInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<{ startSec: number; endSec: number; label: string; fragmentIndex: number | null } | null>(null);
  const masterInputRef = useRef<HTMLInputElement | null>(null);

  // Title state: tracks pending edit between regen and promote.
  const [titleDraft, setTitleDraft] = useState(detail.title);
  const [titlePromotePending, setTitlePromotePending] = useState(false);
  useEffect(() => {
    setTitleDraft(detail.title);
    setTitlePromotePending(false);
  }, [detail.id, detail.title]);

  // Operator note ("re-grabar bloque 3", "subir título"); a manual
  // reminder persisted on the story. Synced from detail; saved on demand.
  const [noteDraft, setNoteDraft] = useState(detail.audioEditorNote ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    setNoteDraft(detail.audioEditorNote ?? "");
    setNoteSaved(false);
  }, [detail.id, detail.audioEditorNote]);

  const saveNote = async () => {
    setSavingNote(true);
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, note: noteDraft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setNoteSaved(true);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error guardando la nota");
    } finally {
      setSavingNote(false);
    }
  };

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
    // Only one region lives at a time; creating a new one replaces it.
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
      clearStopTimer();
      setActiveRangeKey(null);
    });
    ws.on("timeupdate", (t) => {
      setCurrentTime(t);
      // When playback enters a constrained range, auto-pause exactly at
      // `stopAt`. We keep activeRangeKey so the row's icon stays in
      // "play to resume" state; user can click again to replay from
      // start (handled in playRangeToggle).
      if (stopAtRef.current !== null && t >= stopAtRef.current) {
        ws.pause();
      }
    });
    // Any direct interaction with the waveform (click/seek/drag) breaks
    // out of the constrained range so the user can scrub freely.
    ws.on("interaction", () => {
      stopAtRef.current = null;
      clearStopTimer();
      setActiveRangeKey(null);
    });

    return () => {
      clearStopTimer();
      ws.destroy();
      waveRef.current = null;
      regionsRef.current = null;
    };
  }, [sourceUrl, clearStopTimer]);

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
  // Schedule an exact pause at `safeStop` based on wall-clock time from
  // the current position (playbackRate is 1 here). This is what actually
  // prevents the next-segment bleed; `timeupdate` alone is too coarse.
  const scheduleStop = (ws: WaveSurfer, safeStop: number) => {
    clearStopTimer();
    const remainingMs = Math.max(0, (safeStop - ws.getCurrentTime()) * 1000);
    stopTimerRef.current = window.setTimeout(() => {
      const w = waveRef.current;
      if (w && w.isPlaying()) w.pause();
      stopTimerRef.current = null;
    }, remainingMs);
  };

  const playRangeToggle = (key: string, startSec: number, stopAt: number) => {
    const ws = waveRef.current;
    if (!ws) return;
    const safeStop = Math.max(startSec + 0.05, stopAt);
    const sameRange = activeRangeKeyRef.current === key;
    if (sameRange) {
      if (ws.isPlaying()) {
        clearStopTimer();
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
        scheduleStop(ws, safeStop);
      }
      return;
    }
    stopAtRef.current = safeStop;
    setActiveRangeKey(key);
    activeRangeKeyRef.current = key;
    ws.setTime(startSec);
    ws.play();
    scheduleStop(ws, safeStop);
  };

  /**
   * Stop point for a block clip. We stop just before the NEXT block's
   * start rather than at this block's last-word end, because aeneas
   * under-times the last word before a pause (it ended "importante" at
   * 28.56s when the word actually runs to the 28.96s silence). Stopping
   * at nextStart−guard lets the full last word + trailing silence play
   * without bleeding into the next speaker. Floored at endSec so a
   * mis-ordered (drifted) nextStart never cuts the block short.
   */
  const blockStopAt = (endSec: number, nextStartSec: number | null): number => {
    if (nextStartSec === null) return endSec + 0.3;
    return Math.max(endSec, nextStartSec - 0.04);
  };

  const playSelection = () => {
    if (!selection) return;
    playRangeToggle("selection", selection.startSec, selection.endSec + 0.05);
  };

  /* ── Actions ── */

  /**
   * Re-synthesize a tramo with its ElevenLabs voice (same voice + text,
   * a fresh take) and splice it in as a preview. Costs ElevenLabs credits
   *; always behind an explicit confirm so it's never accidental.
   */
  const regenerate = async (
    startSec: number,
    endSec: number,
    voiceId: string | null,
    text: string,
    label: string,
    fragmentIndex: number | null,
  ) => {
    if (!voiceId) {
      setActionError("Este tramo no tiene voz asignada; no se puede regenerar.");
      return;
    }
    if (!text.trim()) {
      setActionError("Este tramo no tiene texto; no se puede regenerar.");
      return;
    }
    const ok = await confirmAsync({
      title: `Regenerar ${label}`,
      message: `Se re-sintetiza con ElevenLabs (voz ${voiceId}). Esto gasta créditos de ElevenLabs.`,
      confirmLabel: "Regenerar",
    });
    if (!ok) return;

    const sectionMode = fragmentIndex !== null;
    // Section mode: update IN PLACE; the screen stays put, the section's
    // row shows progress, and we keep the previous take for revert.
    if (sectionMode) {
      setBusyFragment({ index: fragmentIndex, action: "regen" });
      setActionError(null);
      try {
        const res = await fetch("/api/studio/audio-editor/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId: detail.id, voiceId, text, fragmentIndex }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setSectionState((s) => ({ ...s, [fragmentIndex]: { url: json.sectionUrl, prevUrl: json.prevSectionUrl ?? null } }));
        if (typeof json.regensUsed === "number") {
          setRegenState((s) => ({ ...s, [fragmentIndex]: json.regensUsed }));
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Error regenerando la sección");
      } finally {
        setBusyFragment(null);
      }
      return;
    }

    // Legacy time-splice path (stories without sections): preview + reload.
    setBusyAction("preview");
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, startSec, endSec, voiceId, text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
      clearSelection();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error regenerando el tramo");
    } finally {
      setBusyAction(null);
    }
  };

  // Revert one section to its previous take (no ElevenLabs cost). Updates
  // in place; toggleable.
  const revertSectionAudio = async (fragmentIndex: number) => {
    setBusyFragment({ index: fragmentIndex, action: "revert" });
    setActionError(null);
    try {
      const res = await fetch("/api/studio/audio-editor/revert-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, fragmentIndex }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSectionState((s) => ({ ...s, [fragmentIndex]: { url: json.sectionUrl, prevUrl: json.prevSectionUrl ?? null } }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al volver a la versión anterior");
    } finally {
      setBusyFragment(null);
    }
  };

  /**
   * Manual per-fragment replacement: upload an operator-recorded mp3 for
   * the selected tramo. The splice happens on Modal (ffmpeg), so this
   * works on production where the local regenerate/cut routes can't.
   * Lands as a preview; "Guardar" promotes + re-aligns.
   */
  // Open the file picker targeting a given [startSec, endSec] span. The
  // picked file replaces exactly that span of the master.
  const openUploadPicker = (startSec: number, endSec: number, label: string, fragmentIndex: number | null) => {
    uploadTargetRef.current = { startSec, endSec, label, fragmentIndex };
    fragmentInputRef.current?.click();
  };

  const doUpload = async (file: File) => {
    const target = uploadTargetRef.current;
    if (!target) return;
    const sectionMode = target.fragmentIndex !== null;
    if (sectionMode) setBusyFragment({ index: target.fragmentIndex as number, action: "upload" });
    else setBusyAction("upload");
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append("storyId", detail.id);
      fd.append("startSec", String(target.startSec));
      fd.append("endSec", String(target.endSec));
      if (target.fragmentIndex !== null) fd.append("fragmentIndex", String(target.fragmentIndex));
      fd.append("audio", file);
      const res = await fetch("/api/studio/audio-editor/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.details ? `${json.error}; ${json.details}` : json?.error || `HTTP ${res.status}`);
      }
      if (sectionMode) {
        // In-place: update the section's url, keep the screen put.
        const fi = target.fragmentIndex as number;
        setSectionState((s) => ({ ...s, [fi]: { url: json.sectionUrl, prevUrl: json.prevSectionUrl ?? null } }));
      } else {
        onChanged();
        clearSelection();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error subiendo el fragmento");
    } finally {
      uploadTargetRef.current = null;
      setBusyFragment(null);
      setBusyAction(null);
    }
  };

  /**
   * FULL-MASTER replacement: the operator downloads the master, edits the
   * whole file externally, and uploads the corrected FULL mp3. Lands as a
   * preview; "Guardar" promotes + re-aligns (aeneas), so karaoke stays right.
   */
  const doReplaceMaster = async (file: File) => {
    setBusyAction("replace-master");
    setActionError(null);
    try {
      const fd = new FormData();
      fd.append("storyId", detail.id);
      fd.append("audio", file);
      const res = await fetch("/api/studio/audio-editor/replace-master", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      onChanged();
      clearSelection();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error reemplazando el audio completo");
    } finally {
      setBusyAction(null);
    }
  };

  const promote = async () => {
    setBusyAction("promote");
    setActionError(null);
    try {
      // Persist an edited title text alongside the promote when it changed.
      const titleChanged = !!titleDraft.trim() && titleDraft.trim() !== detail.title;
      const res = await fetch("/api/studio/audio-editor/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: detail.id,
          ...(titleChanged ? { newTitle: titleDraft.trim() } : {}),
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
    if (!(await confirmAsync({
      title: "Re-alinear timings",
      message: "Re-corre aeneas para refrescar los word timings. Puede tardar ~20-40s.",
      confirmLabel: "Re-alinear",
    }))) return;
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
    if (!(await confirmAsync({
      title: "Descartar preview",
      message: "Se descarta el preview y se vuelve al master original.",
      confirmLabel: "Descartar",
      danger: true,
    }))) return;
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
    const ok = await confirmAsync({
      title: "Cortar tramo",
      message: `Cortar ${formatTime(cutRegion.start)} → ${formatTime(cutRegion.end)} (${(
        cutRegion.end - cutRegion.start
      ).toFixed(2)}s). Se elimina del audio y se une con un crossfade. Crea un preview; el master no cambia hasta "Guardar".`,
      confirmLabel: "Cortar",
      danger: true,
    });
    if (!ok) return;
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
    // know exactly when the title's last spoken syllable ends; there's
    // silence between title and body. Park the stop at titleEndSec - 0.1
    // so we capture the title fully without bleeding into "Es" (etc).
    const stop = Math.max(0.5, detail.titleEndSec - 0.1);
    playRangeToggle("title", 0, stop);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Dedicated player for section files (ground-truth standalone takes). */}
      <audio
        ref={sectionAudioRef}
        style={{ display: "none" }}
        onEnded={() => setSectionPlayingKey(null)}
        onPause={() => setSectionPlayingKey(null)}
      />
      <style>{`@keyframes dplspin{to{transform:rotate(360deg)} } @keyframes dplbar{0%{left:-45%}100%{left:100%}}`}</style>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Download the current master mp3 for external editing. */}
          <a
            href={detail.audioUrl}
            download
            target="_blank"
            rel="noreferrer"
            title="Descarga el MP3 del audio maestro para editarlo por fuera (Audacity, etc.)"
            style={{
              ...btnStyle("ghost", false),
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <DownloadIcon />
            <span>Descargar audio</span>
          </a>
          {/* Replace the ENTIRE master with an externally-edited mp3. Hidden
              input driven by the button; lands as preview → "Guardar" promotes
              + re-aligns (aeneas). No regeneration in Studio needed. */}
          <input
            ref={masterInputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file
              if (f) void doReplaceMaster(f);
            }}
          />
          <button
            type="button"
            onClick={() => masterInputRef.current?.click()}
            disabled={busyAction !== null}
            title="Sube un MP3 que reemplace TODO el audio de la historia. Queda como preview hasta que le des Guardar."
            style={{
              ...btnStyle("ghost", busyAction !== null),
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UploadIcon />
            <span>{busyAction === "replace-master" ? "Subiendo..." : "Reemplazar audio completo"}</span>
          </button>
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
      </div>

      {/* ── Operator note / reminder ── */}
      {(() => {
        const dirty = noteDraft.trim() !== (detail.audioEditorNote ?? "").trim();
        return (
          <div
            style={{
              background: noteDraft.trim() ? "rgba(96,165,250,0.07)" : "transparent",
              border: `1px solid ${noteDraft.trim() ? "rgba(96,165,250,0.45)" : CARD_BORDER}`,
              borderRadius: 8,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                📝 Nota / recordatorio (qué falta regenerar o subir)
              </span>
              {noteSaved && !dirty && (
                <span style={{ fontSize: 11, color: SUCCESS, fontWeight: 600 }}>guardada ✓</span>
              )}
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => { setNoteDraft(e.target.value); setNoteSaved(false); }}
              rows={2}
              placeholder="Ej: re-grabar el bloque de Pilar, el título suena cortado…"
              style={{
                width: "100%",
                resize: "vertical",
                minHeight: 44,
                padding: "8px 10px",
                background: "rgba(0,0,0,0.25)",
                border: `1px solid ${dirty ? "#60a5fa" : CARD_BORDER}`,
                borderRadius: 6,
                color: "var(--foreground)",
                fontSize: 13,
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {noteDraft.trim() && (
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={() => { setNoteDraft(""); }}
                  style={btnStyle("ghost", savingNote)}
                >
                  Borrar
                </button>
              )}
              <button
                type="button"
                disabled={savingNote || !dirty}
                onClick={saveNote}
                style={btnStyle("primary", savingNote || !dirty)}
              >
                {savingNote ? "Guardando…" : dirty ? "Guardar nota" : "Guardada"}
              </button>
            </div>
          </div>
        );
      })()}

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
              // Transport play/pause is "free" mode; clear any active
              // constrained range so playback continues past the previous
              // block's stopAt.
              stopAtRef.current = null;
              clearStopTimer();
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
            disabled={!cutRegion || busyAction !== null || !detail.serverCanSplice}
            onClick={cutNoiseRegion}
            title={
              !detail.serverCanSplice
                ? "Cortar ruido requiere ffmpeg y solo corre en local."
                : "Corta el tramo marcado y une con crossfade"
            }
            style={{
              ...btnStyle("primary", !cutRegion || busyAction !== null || !detail.serverCanSplice),
              background: cutRegion && busyAction === null && detail.serverCanSplice ? DANGER : undefined,
              borderColor: cutRegion && busyAction === null && detail.serverCanSplice ? DANGER : undefined,
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
          {/* Manual fragment upload; splices on Modal, so it works on
              production. Hidden input driven by the button. */}
          <input
            ref={fragmentInputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file
              if (f) void doUpload(f);
            }}
          />
          <button
            type="button"
            disabled={!selection || !selectionBlock || busyAction !== null}
            onClick={() => selection && openUploadPicker(selection.startSec, selection.endSec, "selección", selectionBlock?.fragmentIndex ?? null)}
            title="Sube un MP3 que reemplace exactamente el tramo seleccionado"
            style={btnStyle("primary", !selection || !selectionBlock || busyAction !== null)}
          >
            {busyAction === "upload" ? "Subiendo..." : "Subir fragmento seleccionado"}
          </button>
          <button
            type="button"
            disabled={!selection || !selectionBlock || busyAction !== null}
            onClick={() =>
              selection &&
              regenerate(selection.startSec, selection.endSec, selectionBlock?.voiceId ?? null, selection.text, "el tramo seleccionado", selectionBlock?.fragmentIndex ?? null)
            }
            title="Re-sintetiza este tramo con su voz de ElevenLabs (gasta créditos)"
            style={btnStyle("secondary", !selection || !selectionBlock || busyAction !== null)}
          >
            {busyAction === "preview" ? "Regenerando..." : "Regenerar (ElevenLabs)"}
          </button>
        </div>
        {!detail.serverCanSplice && (
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            En este servidor, cortar ruido requiere ffmpeg y solo corre en local. Para arreglar audio usa
            <strong> subir audio</strong> (el botón ⬆ de cada bloque, o el tramo seleccionado).
          </div>
        )}
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
          <span>BLOQUES DEL AUDIO; ⬆ sube un MP3 para reemplazar ese bloque; o click en palabras para un tramo</span>
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
                <VoiceTag name={detail.narratorVoiceName} id={detail.narratorVoiceId} />
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
              {(() => {
                const tfi = detail.titleFragmentIndex;
                const titleSec = tfi !== null && sectionState[tfi] ? sectionState[tfi].url : detail.titleSectionUrl;
                const titlePrev = tfi !== null && sectionState[tfi] ? sectionState[tfi].prevUrl : detail.titlePrevSectionUrl;
                const hasSection = !!titleSec;
                const anyBusy = busyFragment !== null;
                const titleBusy = tfi !== null && busyFragment?.index === tfi;
                const titleUsed = regensUsedFor(tfi, detail.titleRegensUsed);
                const titleAtLimit = titleUsed >= detail.regenLimit;
                const titleCmt = commentFor(tfi, detail.titleComment);
                const titleCmtOpen = tfi !== null && openComment === tfi;
                const titleActive = hasSection ? sectionPlayingKey === "title" : activeRangeKey === "title";
                const showPause = hasSection ? titleActive : titleActive && isPlaying;
                return (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", minWidth: 132 }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <IconButton
                      icon={showPause ? "pause" : "play"}
                      title={showPause ? "Pausar título" : "Escuchar título"}
                      disabled={anyBusy || (!hasSection && detail.titleEndSec === null)}
                      active={titleActive}
                      onClick={() => {
                        if (hasSection) playSection("title", titleSec as string);
                        else playTitle();
                      }}
                    />
                <IconButton
                  icon="upload"
                  title={detail.titleEndSec === null ? "No disponible (sin timing de título)" : anyBusy ? "Ocupado…" : "Subir un MP3 que reemplace el título narrado"}
                  disabled={detail.titleEndSec === null || anyBusy}
                  onClick={() =>
                    detail.titleEndSec !== null && openUploadPicker(0, detail.titleEndSec, "título", detail.titleFragmentIndex)
                  }
                />
                <IconButton
                  icon="regen"
                  title={
                    detail.titleEndSec === null ? "No disponible (sin timing de título)"
                      : !detail.narratorVoiceId ? "Sin voz de narrador"
                        : titleAtLimit ? `Límite de ${detail.regenLimit} regeneraciones alcanzado; usa “Subir fragmento”`
                          : anyBusy ? "Ocupado…"
                            : `Regenerar el título con ElevenLabs (gasta créditos) · ${titleUsed}/${detail.regenLimit}`
                  }
                  disabled={detail.titleEndSec === null || anyBusy || !detail.narratorVoiceId || !titleDraft.trim() || titleAtLimit}
                  onClick={() =>
                    detail.titleEndSec !== null &&
                    regenerate(0, detail.titleEndSec, detail.narratorVoiceId, titleDraft, "el título", detail.titleFragmentIndex)
                  }
                />
                {titlePrev && (
                  <IconButton
                    icon="revert"
                    title="Volver a la versión anterior del título"
                    disabled={anyBusy}
                    onClick={() => tfi !== null && revertSectionAudio(tfi)}
                  />
                )}
                {tfi !== null && (
                  <IconButton
                    icon="comment"
                    title={titleCmt ? `Comentario: ${titleCmt}` : "Agregar comentario al título"}
                    active={!!titleCmt || titleCmtOpen}
                    onClick={() => toggleComment(tfi, titleCmt)}
                  />
                )}
                </div>
                {tfi !== null && (titleCmtOpen || titleCmt) && (
                  <CommentBox
                    open={titleCmtOpen}
                    comment={titleCmt}
                    draft={commentDraft}
                    saving={savingComment}
                    onOpen={() => toggleComment(tfi, titleCmt)}
                    onChange={setCommentDraft}
                    onSave={() => saveComment(tfi)}
                    onCancel={() => setOpenComment(null)}
                  />
                )}
                {titleBusy && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, width: 124 }}>
                    <span style={{ fontSize: 10, color: ACCENT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Spinner />
                      {busyFragment?.action === "regen" ? "Regenerando" : busyFragment?.action === "revert" ? "Volviendo" : "Subiendo"}… {busyElapsed}s
                    </span>
                    <div style={{ position: "relative", height: 3, width: "100%", background: "rgba(252,211,77,0.15)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, height: "100%", width: "45%", background: ACCENT, borderRadius: 2, animation: "dplbar 1.1s ease-in-out infinite" }} />
                    </div>
                  </div>
                )}
                {!titleBusy && tfi !== null && (
                  <span style={{ fontSize: 10, color: titleAtLimit ? DANGER : "rgba(255,255,255,0.45)" }}>
                    {titleAtLimit ? `regen ${titleUsed}/${detail.regenLimit} · sube manual` : `regen ${titleUsed}/${detail.regenLimit}`}
                  </span>
                )}
              </div>
                );
              })()}
            </div>
          )}
          {wordsByBlock.map(({ block, words }, idx) => {
            if (words.length === 0) return null;
            const colorIdx = speakerColorIndex.get(block.speakerLabel) ?? 0;
            const color = speakerColor(block.speakerLabel, colorIdx);
            const firstTimed = words.find((w) => w.hasTime);
            const lastTimed = [...words].reverse().find((w) => w.hasTime);
            // Prefer the exact generation offsets; fall back to aeneas
            // word timings for stories without captured fragments.
            const blockStart = block.startSec ?? firstTimed?.startSec ?? null;
            const blockEnd = block.endSec ?? lastTimed?.endSec ?? null;
            // Next block's start; exact offset preferred, else its first
            // timed word. Used as the ceiling so playback doesn't bleed
            // into the next speaker.
            let nextStart: number | null = null;
            for (let j = idx + 1; j < wordsByBlock.length; j++) {
              const nb = wordsByBlock[j];
              if (nb.block.startSec !== null) { nextStart = nb.block.startSec; break; }
              const nextFirst = nb.words.find((w) => w.hasTime);
              if (nextFirst) {
                nextStart = nextFirst.startSec ?? null;
                break;
              }
            }
            const canPlay = blockStart !== null && blockEnd !== null;
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
                <div style={{ minWidth: 0 }}>
                  <VoiceTag name={block.voiceName} id={block.voiceId} />
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
                </div>
                {(() => {
                  const blockKey = `block-${block.index}`;
                  const fi = block.fragmentIndex;
                  const secUrl = sectionUrlFor(block);
                  const hasSection = !!secUrl;
                  const prevUrl = prevUrlFor(block);
                  const anyBusy = busyFragment !== null;
                  const thisBusy = fi !== null && busyFragment?.index === fi;
                  const blockUsed = regensUsedFor(fi, block.regensUsed);
                  const blockAtLimit = fi !== null && blockUsed >= block.regenLimit;
                  const blockCmt = commentFor(fi, block.comment);
                  const blockCmtOpen = fi !== null && openComment === fi;
                  const blockActive = hasSection ? sectionPlayingKey === blockKey : activeRangeKey === blockKey;
                  const showPause = hasSection ? blockActive : blockActive && isPlaying;
                  const playable = hasSection || canPlay;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end", minWidth: 132 }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <IconButton
                          icon={showPause ? "pause" : "play"}
                          title={showPause ? "Pausar bloque" : blockActive ? "Reanudar bloque" : "Escuchar este bloque"}
                          disabled={!playable || anyBusy}
                          active={blockActive}
                          onClick={() => {
                            if (hasSection) playSection(blockKey, secUrl as string);
                            else if (canPlay) playRangeToggle(blockKey, blockStart as number, blockStopAt(blockEnd as number, nextStart));
                          }}
                        />
                        {hasSection && (
                          <a
                            href={secUrl as string}
                            download
                            target="_blank"
                            rel="noreferrer"
                            title={`Descargar el audio de este segmento (${block.speakerLabel}) para editarlo y volver a subirlo`}
                            aria-label={`Descargar segmento ${block.speakerLabel}`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 6,
                              background: "transparent",
                              border: `1px solid ${CARD_BORDER}`,
                              color: "var(--muted)",
                              opacity: 0.55,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textDecoration: "none",
                              transition: "opacity 0.15s, color 0.15s, border-color 0.15s, background 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "1";
                              e.currentTarget.style.color = ACCENT;
                              e.currentTarget.style.borderColor = `${ACCENT}66`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = "0.55";
                              e.currentTarget.style.color = "var(--muted)";
                              e.currentTarget.style.borderColor = CARD_BORDER;
                            }}
                          >
                            <DownloadIcon />
                          </a>
                        )}
                        <IconButton
                          icon="upload"
                          title={anyBusy ? "Ocupado…" : `Subir un MP3 que reemplace el bloque de ${block.speakerLabel}`}
                          disabled={!playable || anyBusy}
                          onClick={() => playable && openUploadPicker(blockStart ?? 0, blockEnd ?? 0, block.speakerLabel, fi)}
                        />
                        <IconButton
                          icon="regen"
                          title={
                            !block.voiceId ? "Sin voz asignada"
                              : blockAtLimit ? `Límite de ${block.regenLimit} regeneraciones alcanzado; usa “Subir fragmento”`
                                : anyBusy ? "Ocupado…"
                                  : `Regenerar el bloque de ${block.speakerLabel} con ElevenLabs (gasta créditos) · ${blockUsed}/${block.regenLimit}`
                          }
                          disabled={!playable || anyBusy || !block.voiceId || blockAtLimit}
                          onClick={() =>
                            regenerate(
                              blockStart ?? 0,
                              blockEnd ?? 0,
                              block.voiceId,
                              detail.storyPlainText.slice(block.startChar, block.endChar),
                              `el bloque de ${block.speakerLabel}`,
                              fi,
                            )
                          }
                        />
                        {prevUrl && (
                          <IconButton
                            icon="revert"
                            title="Volver a la versión anterior de esta sección"
                            disabled={anyBusy}
                            onClick={() => fi !== null && revertSectionAudio(fi)}
                          />
                        )}
                        {fi !== null && (
                          <IconButton
                            icon="comment"
                            title={blockCmt ? `Comentario: ${blockCmt}` : `Agregar comentario al bloque de ${block.speakerLabel}`}
                            active={!!blockCmt || blockCmtOpen}
                            onClick={() => toggleComment(fi, blockCmt)}
                          />
                        )}
                      </div>
                      {fi !== null && (blockCmtOpen || blockCmt) && (
                        <CommentBox
                          open={blockCmtOpen}
                          comment={blockCmt}
                          draft={commentDraft}
                          saving={savingComment}
                          onOpen={() => toggleComment(fi, blockCmt)}
                          onChange={setCommentDraft}
                          onSave={() => saveComment(fi)}
                          onCancel={() => setOpenComment(null)}
                        />
                      )}
                      {thisBusy && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, width: 124 }}>
                          <span style={{ fontSize: 10, color: ACCENT, display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Spinner />
                            {busyFragment?.action === "regen" ? "Regenerando" : busyFragment?.action === "revert" ? "Volviendo" : "Subiendo"}… {busyElapsed}s
                          </span>
                          <div style={{ position: "relative", height: 3, width: "100%", background: "rgba(252,211,77,0.15)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, height: "100%", width: "45%", background: ACCENT, borderRadius: 2, animation: "dplbar 1.1s ease-in-out infinite" }} />
                          </div>
                        </div>
                      )}
                      {!thisBusy && fi !== null && (
                        <span style={{ fontSize: 10, color: blockAtLimit ? DANGER : "rgba(255,255,255,0.45)" }}>
                          {blockAtLimit ? `regen ${blockUsed}/${block.regenLimit} · sube manual` : `regen ${blockUsed}/${block.regenLimit}`}
                        </span>
                      )}
                    </div>
                  );
                })()}
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

      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          danger={confirmDialog.danger}
          onCancel={() => { confirmDialog.resolve(false); setConfirmDialog(null); }}
          onConfirm={() => { confirmDialog.resolve(true); setConfirmDialog(null); }}
        />
      )}
    </div>
  );
}

/** In-app confirm dialog styled to match the editor (replaces the
 *  browser's native window.confirm). Closes on Escape / backdrop click
 *  (treated as cancel). */
function ConfirmModal({
  title, message, confirmLabel, danger, onCancel, onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "min(440px, 100%)",
          background: "#0f1729",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 14,
          padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 36, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "transparent", color: "var(--foreground)", border: `1px solid ${CARD_BORDER}`, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            style={{
              height: 36, padding: "0 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: danger ? DANGER : ACCENT,
              color: danger ? "#fff" : "#0a1628",
              border: `1px solid ${danger ? DANGER : ACCENT}`,
            }}
          >
            {confirmLabel}
          </button>
        </div>
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

/** Inline SVG icons; flat, monochrome, no emojis. Each renders at 12px
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
function UploadIcon({ size = 12 }: { size?: number }) {
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
      <path d="M8 10.5V2.5" />
      <polyline points="4.8 5.7 8 2.5 11.2 5.7" />
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
    </svg>
  );
}
function DownloadIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2.5v8" />
      <polyline points="4.8 7.3 8 10.5 11.2 7.3" />
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
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
function RevertIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a5 5 0 1 0 1.5-3.6" />
      <polyline points="2 2.5 2 5.2 4.7 5.2" />
    </svg>
  );
}
function CommentIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 3.5h11v8h-7l-3 2.5v-2.5h-1z" />
    </svg>
  );
}
function Spinner({ size = 12 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid rgba(252,211,77,0.3)",
        borderTopColor: ACCENT,
        borderRadius: "50%",
        animation: "dplspin 0.8s linear infinite",
      }}
    />
  );
}
/** Per-segment operator comment: collapsed it shows the saved text (click
 *  to edit); open it shows a textarea + Guardar/Cancelar. */
function CommentBox(props: {
  open: boolean;
  comment: string | null;
  draft: string;
  saving: boolean;
  onOpen: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { open, comment, draft, saving, onOpen, onChange, onSave, onCancel } = props;
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        title="Editar comentario"
        style={{
          maxWidth: 200,
          textAlign: "right",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 11,
          lineHeight: 1.35,
          color: "#60a5fa",
          fontStyle: "italic",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
        }}
      >
        💬 {comment}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 210, alignItems: "stretch" }}>
      <textarea
        value={draft}
        autoFocus
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        rows={2}
        placeholder="Ej: subí manual / falta regenerar…"
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 40,
          padding: "6px 8px",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid #60a5fa",
          borderRadius: 6,
          color: "var(--foreground)",
          fontSize: 12,
          fontFamily: "inherit",
          lineHeight: 1.4,
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} disabled={saving} style={{ ...btnStyle("ghost", saving), padding: "3px 8px", fontSize: 11 }}>
          Cancelar
        </button>
        <button type="button" onClick={onSave} disabled={saving} style={{ ...btnStyle("primary", saving), padding: "3px 8px", fontSize: 11 }}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function IconButton(props: {
  icon: "play" | "pause" | "regen" | "upload" | "revert" | "comment";
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  const { icon, title, disabled, active, onClick } = props;
  const glyph =
    icon === "play" ? <PlayIcon /> : icon === "pause" ? <PauseIcon /> : icon === "upload" ? <UploadIcon /> : icon === "revert" ? <RevertIcon /> : icon === "comment" ? <CommentIcon /> : <RegenIcon />;
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

/** Shows the voice name + ElevenLabs ID for a block, with a one-click
 *  copy of the ID; so the operator knows which voice to generate in
 *  ElevenLabs before uploading a replacement. */
function VoiceTag({ name, id }: { name: string | null; id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        padding: "3px 7px",
        borderRadius: 5,
        background: "rgba(96,165,250,0.08)",
        border: "1px solid rgba(96,165,250,0.30)",
        fontSize: 11,
        marginBottom: 6,
      }}
    >
      <span style={{ color: "#60a5fa" }} aria-hidden>🎙</span>
      {name && <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{name}</span>}
      <code
        style={{ fontSize: 10, color: "var(--muted)", fontFamily: "ui-monospace, SFMono-Regular, monospace", userSelect: "all" }}
      >
        {id}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(id).then(
            () => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); },
            () => {},
          );
        }}
        title="Copiar ID de la voz"
        style={{
          fontSize: 10,
          padding: "1px 6px",
          borderRadius: 4,
          border: "1px solid rgba(96,165,250,0.45)",
          background: "transparent",
          color: copied ? "#22c55e" : "#60a5fa",
          cursor: "pointer",
        }}
      >
        {copied ? "copiado ✓" : "copiar ID"}
      </button>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
