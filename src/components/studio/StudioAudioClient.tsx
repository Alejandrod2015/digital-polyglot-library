"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ENGINE_INFO, type Engine } from "@/lib/voiceCatalog";

type StoryRow = {
  id: string;
  title: string | null;
  level: string;
  topic: string;
  slotIndex: number;
  wordCount: number | null;
  audioUrl: string | null;
  audioStatus: string;
  audioFilename: string | null;
  audioUrlPreview: string | null;
  audioFilenamePreview: string | null;
  ambientTag: string | null;
  voiceId: string | null;
  dialogueSpec: Array<{ voice: string; text: string }> | null;
  updatedAt: string;
  journey: { id: string; name: string; language: string; variant: string };
};

type QueueResponse = { stories: StoryRow[] };

type LicenseCode =
  | "Apache-2.0" | "MIT" | "CC0" | "CC-BY-3.0" | "CC-BY-4.0" | "CC-BY-SA-4.0"
  | "ElevenLabs-Premade" | "ElevenLabs-Pro-2yr" | "Public-Domain" | "Unverified";

type VoiceEntry = {
  id: string;
  engine: "kokoro" | "piper" | "f5" | "coqui" | "bark" | "elevenlabs" | "chatterbox" | "qwen";
  language: string;
  region?: string;
  gender: "f" | "m";
  label: string;
  status: "approved" | "candidate" | "discarded";
  reason?: string;
  license?: LicenseCode;
  licenseSource?: string;
  attribution?: string;
};

type ClonedVoice = {
  id: string;
  name: string;
  language: string;
  region: string | null;
  gender: string;
  refText: string;
  createdAt: string;
};

const SUPPORTED_LANGS = new Set([
  "english",
  "spanish",
  "french",
  "italian",
  "portuguese",
  "japanese",
  "chinese",
  "hindi",
]);

type StatusFilter = "missing" | "ready" | "failed" | "all";

export default function StudioAudioClient() {
  const [stories, setStories] = useState<StoryRow[] | null>(null);
  const [ambients, setAmbients] = useState<string[]>([]);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [showClonedSection, setShowClonedSection] = useState(false);
  const [showVoiceGallery, setShowVoiceGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("missing");
  const [language, setLanguage] = useState<string>("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [queueRes, ambRes, voicesRes, clonedRes] = await Promise.all([
        fetch("/api/studio/audio/queue", { cache: "no-store" }),
        fetch("/api/studio/audio/ambients", { cache: "no-store" }),
        fetch("/api/studio/audio/voices", { cache: "no-store" }),
        fetch("/api/studio/audio/cloned-voices", { cache: "no-store" }),
      ]);
      if (!queueRes.ok) throw new Error(`Error ${queueRes.status}`);
      const data = (await queueRes.json()) as QueueResponse;
      setStories(data.stories);
      if (ambRes.ok) {
        const a = (await ambRes.json()) as { ambients: string[] };
        setAmbients(a.ambients);
      }
      if (voicesRes.ok) {
        const v = (await voicesRes.json()) as { voices: VoiceEntry[] };
        setVoices(v.voices);
      }
      if (clonedRes.ok) {
        const c = (await clonedRes.json()) as { voices: ClonedVoice[] };
        setClonedVoices(c.voices);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando historias");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const [expandedDialogue, setExpandedDialogue] = useState<Record<string, boolean>>({});
  const [dialogueDraft, setDialogueDraft] = useState<Record<string, string>>({});
  // For the casting flow: per-story detected segments + speaker→voice mapping
  const [detection, setDetection] = useState<Record<string, { segments: Array<{ speaker: string; text: string }>; speakers: string[] }>>({});
  const [castMap, setCastMap] = useState<Record<string, Record<string, string>>>({});

  const detectDialogue = useCallback(async (storyId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/studio/audio/dialogue/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setDetection((cur) => ({ ...cur, [storyId]: data }));
      // Initialize cast map with empty selections so dropdowns render
      setCastMap((cur) => ({
        ...cur,
        [storyId]: cur[storyId] ?? Object.fromEntries((data.speakers as string[]).map((s) => [s, ""])),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error detectando diálogos");
    }
  }, []);

  const applyCasting = useCallback(async (storyId: string) => {
    const det = detection[storyId];
    const cast = castMap[storyId] ?? {};
    if (!det) { setError("Primero detecta los personajes"); return; }
    // Validate every speaker has a voice
    const missing = det.speakers.filter((sp) => !cast[sp]);
    if (missing.length > 0) {
      setError(`Asigna voz a: ${missing.join(", ")}`);
      return;
    }
    const spec = det.segments.map((seg) => ({ voice: cast[seg.speaker], text: seg.text }));
    try {
      const res = await fetch("/api/studio/audio/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, spec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando casting");
    }
  }, [detection, castMap, load]);

  const saveDialogue = useCallback(async (storyId: string, jsonText: string) => {
    let parsed: unknown = null;
    const trimmed = jsonText.trim();
    if (trimmed) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        setError("JSON inválido — revisa los corchetes y comillas");
        return;
      }
    }
    try {
      const res = await fetch("/api/studio/audio/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, spec: trimmed ? parsed : null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ? `${data.error}${data.details ? ` — ${data.details}` : ""}` : `HTTP ${res.status}`);
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando diálogo");
    }
  }, [load]);

  const setVoiceId = useCallback(async (storyId: string, voiceId: string | null) => {
    setStories((curr) => curr?.map((s) => s.id === storyId ? { ...s, voiceId } : s) ?? curr);
    try {
      const res = await fetch("/api/studio/audio/set-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, voiceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando voz");
    }
  }, [load]);

  const setAmbientTag = useCallback(async (storyId: string, tag: string | null) => {
    setStories((curr) => curr?.map((s) => s.id === storyId ? { ...s, ambientTag: tag } : s) ?? curr);
    try {
      const res = await fetch("/api/studio/audio/set-ambient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, ambientTag: tag }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando ambiente");
    }
  }, [load]);

  const languages = useMemo(() => {
    const set = new Set<string>();
    stories?.forEach((s) => set.add(s.journey.language));
    return ["all", ...Array.from(set).sort()];
  }, [stories]);

  const filtered = useMemo(() => {
    if (!stories) return [];
    return stories.filter((s) => {
      if (language !== "all" && s.journey.language !== language) return false;
      if (filter === "missing") return !s.audioUrl;
      if (filter === "ready") return s.audioStatus === "ready" && !!s.audioUrl;
      if (filter === "failed") return s.audioStatus === "failed";
      return true;
    });
  }, [stories, filter, language]);

  const generate = useCallback(async (storyId: string): Promise<boolean> => {
    setBusy((b) => ({ ...b, [storyId]: true }));
    try {
      const res = await fetch("/api/studio/audio/generate-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ? `${data.error}${data.details ? ` — ${data.details}` : ""}${data.hint ? ` (${data.hint})` : ""}` : `HTTP ${res.status}`;
        setError(msg);
        return false;
      }
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando audio");
      return false;
    } finally {
      setBusy((b) => ({ ...b, [storyId]: false }));
    }
  }, [load]);

  const promotePreview = useCallback(async (storyId: string) => {
    setBusy((b) => ({ ...b, [storyId]: true }));
    try {
      const res = await fetch("/api/studio/audio/promote-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      await load();
    } finally {
      setBusy((b) => ({ ...b, [storyId]: false }));
    }
  }, [load]);

  const discardPreview = useCallback(async (storyId: string) => {
    setBusy((b) => ({ ...b, [storyId]: true }));
    try {
      const res = await fetch("/api/studio/audio/discard-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      await load();
    } finally {
      setBusy((b) => ({ ...b, [storyId]: false }));
    }
  }, [load]);

  const runBatch = useCallback(async () => {
    const targets = filtered.filter((s) => SUPPORTED_LANGS.has(s.journey.language.toLowerCase()) && !s.audioUrl);
    if (targets.length === 0) return;
    setBatchRunning(true);
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const ok = await generate(targets[i].id);
      setProgress({ done: i + 1, total: targets.length });
      if (!ok) break;
    }
    setBatchRunning(false);
  }, [filtered, generate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <VoiceGallerySection
        open={showVoiceGallery}
        onToggle={() => setShowVoiceGallery((v) => !v)}
        voices={voices}
        clonedVoices={clonedVoices}
      />

      <ClonedVoicesSection
        open={showClonedSection}
        onToggle={() => setShowClonedSection((v) => !v)}
        voices={clonedVoices}
        onChange={() => void load()}
        onError={(msg) => setError(msg)}
      />

      <div style={{ padding: 16, borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "var(--muted)" }}>
          Estado
          <select value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)} style={selectStyle}>
            <option value="missing">Sin audio</option>
            <option value="ready">Con audio</option>
            <option value="failed">Falladas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", fontSize: 12, color: "var(--muted)" }}>
          Idioma
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => void load()}
          style={btnGhost}
        >
          Recargar
        </button>
        <button
          onClick={() => void runBatch()}
          disabled={batchRunning || filtered.filter((s) => !s.audioUrl).length === 0}
          style={{ ...btnPrimary, opacity: batchRunning ? 0.6 : 1 }}
        >
          {batchRunning && progress ? `Generando ${progress.done}/${progress.total}` : `Generar lote (${filtered.filter((s) => !s.audioUrl && SUPPORTED_LANGS.has(s.journey.language.toLowerCase())).length})`}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!stories && <div className="studio-skeleton" style={{ height: 240 }} />}

      {stories && filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          No hay historias que coincidan con el filtro.
        </div>
      )}

      {stories && filtered.length > 0 && (
        <div style={{ borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden", backgroundColor: "var(--card-bg)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ backgroundColor: "rgba(255,255,255,0.03)", textAlign: "left" }}>
              <tr>
                <th style={th}>Historia</th>
                <th style={th}>Journey</th>
                <th style={th}>Lang</th>
                <th style={th}>Nivel</th>
                <th style={th}>Words</th>
                <th style={th}>Voz</th>
                <th style={th}>Ambiente</th>
                <th style={th}>Audio</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const langLower = s.journey.language.toLowerCase();
                const supported = SUPPORTED_LANGS.has(langLower);
                const isBusy = !!busy[s.id];
                return (
                  <Fragment key={s.id}>
                  <tr style={{ borderTop: "1px solid var(--card-border)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{s.title ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.topic} · slot {s.slotIndex}</div>
                    </td>
                    <td style={td}>{s.journey.name}</td>
                    <td style={td}>{s.journey.language}</td>
                    <td style={td}>{s.level}</td>
                    <td style={td}>{s.wordCount ?? "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <select
                          value={s.voiceId ?? ""}
                          onChange={(e) => void setVoiceId(s.id, e.target.value || null)}
                          disabled={!!s.dialogueSpec && s.dialogueSpec.length > 0}
                          style={{ ...selectStyle, maxWidth: 200, opacity: s.dialogueSpec && s.dialogueSpec.length > 0 ? 0.4 : 1 }}
                          title={s.dialogueSpec && s.dialogueSpec.length > 0 ? "Esta historia usa diálogo multi-voz; cada segmento define su voz" : ""}
                        >
                          <option value="">— defecto del idioma —</option>
                          {voices
                            .filter((v) => v.language === s.journey.language.toLowerCase() && v.status === "approved")
                            .map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            setExpandedDialogue((cur) => ({ ...cur, [s.id]: !cur[s.id] }));
                            setDialogueDraft((cur) => ({
                              ...cur,
                              [s.id]: cur[s.id] ?? (s.dialogueSpec ? JSON.stringify(s.dialogueSpec, null, 2) : ""),
                            }));
                          }}
                          style={{ ...btnSmall, fontSize: 11 }}
                        >
                          {s.dialogueSpec && s.dialogueSpec.length > 0
                            ? `Diálogo (${s.dialogueSpec.length} segmentos) ▾`
                            : "+ Diálogo multi-voz"}
                        </button>
                      </div>
                    </td>
                    <td style={td}>
                      <select
                        value={s.ambientTag ?? ""}
                        onChange={(e) => void setAmbientTag(s.id, e.target.value || null)}
                        style={selectStyle}
                      >
                        <option value="">— ninguno —</option>
                        {ambients.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      {s.audioUrl ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 56 }}>actual</span>
                            <audio src={s.audioUrl} controls style={{ height: 28, maxWidth: 220 }} />
                          </div>
                          {s.audioUrlPreview && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10, color: "#14b8a6", fontWeight: 700, minWidth: 56 }}>preview</span>
                              <audio src={s.audioUrlPreview} controls style={{ height: 28, maxWidth: 220 }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: s.audioStatus === "failed" ? "#ef4444" : "var(--muted)" }}>
                          {s.audioStatus}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {s.audioUrlPreview ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button
                            onClick={() => void promotePreview(s.id)}
                            disabled={isBusy}
                            style={{ ...btnSmall, backgroundColor: "#14b8a6", color: "#fff", borderColor: "transparent", opacity: isBusy ? 0.5 : 1 }}
                          >
                            Usar preview
                          </button>
                          <button
                            onClick={() => void discardPreview(s.id)}
                            disabled={isBusy}
                            style={{ ...btnSmall, opacity: isBusy ? 0.5 : 1 }}
                          >
                            Descartar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => void generate(s.id)}
                          disabled={isBusy || !supported || batchRunning}
                          title={!supported ? `${s.journey.language} aún no está soportado` : ""}
                          style={{ ...btnSmall, opacity: isBusy || !supported ? 0.5 : 1 }}
                        >
                          {isBusy ? "Generando…" : s.audioUrl ? "Regenerar" : "Generar"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedDialogue[s.id] && (
                    <tr>
                      <td colSpan={9} style={{ padding: "12px 16px", backgroundColor: "rgba(20,184,166,0.04)", borderTop: "1px dashed var(--card-border)" }}>
                        <DialoguePanel
                          story={s}
                          voices={voices.filter((v) => v.language === s.journey.language.toLowerCase())}
                          detection={detection[s.id]}
                          cast={castMap[s.id] ?? {}}
                          jsonDraft={dialogueDraft[s.id] ?? ""}
                          onDetect={() => void detectDialogue(s.id)}
                          onCastChange={(speaker, voiceId) => setCastMap((cur) => ({ ...cur, [s.id]: { ...(cur[s.id] ?? {}), [speaker]: voiceId } }))}
                          onApplyCasting={() => void applyCasting(s.id)}
                          onJsonDraftChange={(v) => setDialogueDraft((cur) => ({ ...cur, [s.id]: v }))}
                          onSaveJson={() => void saveDialogue(s.id, dialogueDraft[s.id] ?? "")}
                          onClear={() => void saveDialogue(s.id, "")}
                          onClose={() => setExpandedDialogue((cur) => ({ ...cur, [s.id]: false }))}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  marginTop: 4,
  height: 32,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  height: 32,
  padding: "0 14px",
  borderRadius: 6,
  border: "none",
  backgroundColor: "#14b8a6",
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "transparent",
  color: "var(--foreground)",
  fontSize: 13,
  cursor: "pointer",
};

const btnSmall: React.CSSProperties = {
  height: 28,
  padding: "0 10px",
  borderRadius: 5,
  border: "1px solid var(--card-border)",
  backgroundColor: "transparent",
  color: "var(--foreground)",
  fontSize: 12,
  cursor: "pointer",
};

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };

/* ───── Voice gallery (audio previews of every available voice) ───── */

const VOICE_LANG_LABELS: Record<string, string> = {
  spanish: "Español",
  english: "English",
  german: "Deutsch",
  french: "Français",
  italian: "Italiano",
  portuguese: "Português",
};

// Sub-headings inside each language section. Order also drives display order.
const VOICE_REGION_LABELS: Record<string, string> = {
  ES: "España",
  LATAM: "Latinoamérica",
  MX: "México",
  AR: "Argentina",
  CO: "Colombia",
  PE: "Perú",
  BR: "Brasil",
  PT: "Portugal",
  IT: "Italia",
  DE: "Alemania",
  FR: "Francia",
  US: "Estados Unidos",
};
const VOICE_REGION_ORDER = Object.keys(VOICE_REGION_LABELS);

function safeVoiceId(voiceId: string): string {
  return voiceId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sampleUrl(voice: VoiceEntry | { id: string; engine: "f5" }, isCloned: boolean): string {
  if (isCloned) {
    // Cloned voices: served as the original ref WAV, filename pattern f5_<id>.wav
    const id = voice.id.startsWith("f5/") ? voice.id.slice(3) : voice.id;
    return `/voice-samples/f5_${id}.wav`;
  }
  return `/voice-samples/${safeVoiceId(voice.id)}.mp3`;
}

function VoiceGallerySection({
  open, onToggle, voices, clonedVoices,
}: {
  open: boolean;
  onToggle: () => void;
  voices: VoiceEntry[];
  clonedVoices: ClonedVoice[];
}) {
  const internalApproved = useMemo(
    () => voices.filter((v) => v.status === "approved" && v.engine !== "f5" && v.engine !== "elevenlabs"),
    [voices],
  );
  const elevenlabsApproved = useMemo(
    () => voices.filter((v) => v.status === "approved" && v.engine === "elevenlabs"),
    [voices],
  );
  const candidates = useMemo(() => voices.filter((v) => v.status === "candidate" && v.engine !== "f5"), [voices]);
  const discarded = useMemo(() => voices.filter((v) => v.status === "discarded"), [voices]);
  const total =
    internalApproved.length +
    elevenlabsApproved.length +
    candidates.length +
    clonedVoices.length +
    discarded.length;

  return (
    <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
      >
        <span style={{ fontWeight: 600 }}>
          Probar voces <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {total}</span>
        </span>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 10 }}>
          <VoiceSubsection
            title="Internas (TTS local)"
            description="Voces que corren on-prem (Piper / Bark / Coqui). Costo cero por uso."
            color="#14b8a6"
            voices={internalApproved}
            clonedVoices={[]}
            emptyMsg="Aún no hay voces internas aprobadas."
          />
          <VoiceSubsection
            title="ElevenLabs (TTS externo)"
            description="Voces de ElevenLabs. Pago por carácter generado; usadas para narrador y diálogos en alemán."
            color="#3b82f6"
            voices={elevenlabsApproved}
            clonedVoices={[]}
            emptyMsg="Aún no hay voces de ElevenLabs aprobadas."
          />
          <VoiceSubsection
            title="Por aprobar"
            description="Candidatas en testing. NO disponibles para asignar a historias hasta que las apruebes."
            color="#eab308"
            voices={candidates}
            clonedVoices={clonedVoices}
            emptyMsg="No hay candidatas en testing. Cuando se sumen voces nuevas para evaluar, aparecerán aquí."
          />
          <VoiceSubsection
            title="Descartadas"
            description="Voces rechazadas; quedan aquí como memoria para no volver a sumarlas."
            color="#ef4444"
            voices={discarded}
            clonedVoices={[]}
            emptyMsg="Sin voces descartadas registradas."
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  );
}

function VoiceSubsection({
  title, description, color, voices, clonedVoices, emptyMsg, defaultOpen = true,
}: {
  title: string;
  description: string;
  color: string;
  voices: VoiceEntry[];
  clonedVoices: ClonedVoice[];
  emptyMsg: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const staticByLang = useMemo(() => {
    const map: Record<string, VoiceEntry[]> = {};
    for (const v of voices) (map[v.language] ??= []).push(v);
    return map;
  }, [voices]);
  const clonedByLang = useMemo(() => {
    const map: Record<string, ClonedVoice[]> = {};
    for (const c of clonedVoices) (map[c.language] ??= []).push(c);
    return map;
  }, [clonedVoices]);
  const allLangs = Array.from(new Set([...Object.keys(staticByLang), ...Object.keys(clonedByLang)])).sort();
  const total = voices.length + clonedVoices.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 10, borderLeft: `3px solid ${color}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "baseline", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }}
      >
        <span style={{ fontSize: 10, color: "var(--muted)", width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>· {total}</span>
        <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>{description}</span>
      </button>
      {!open ? null : total === 0 ? (
        <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>{emptyMsg}</div>
      ) : (
        <>
        <EnginesLegend voices={voices} />
        {allLangs.map((lang) => {
          const langStatic = staticByLang[lang] ?? [];
          const langCloned = clonedByLang[lang] ?? [];
          const regionBuckets = new Map<string, VoiceEntry[]>();
          for (const v of langStatic) {
            const key = v.region ?? "—";
            const bucket = regionBuckets.get(key) ?? [];
            bucket.push(v);
            regionBuckets.set(key, bucket);
          }
          const sortedRegions = Array.from(regionBuckets.keys()).sort((a, b) => {
            const ai = VOICE_REGION_ORDER.indexOf(a);
            const bi = VOICE_REGION_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
          const flatCount = langStatic.length + langCloned.length;
          // Single-region (PT, IT, DE today) → skip region sub-headers, render a flat grid.
          // Multi-region (Español) → keep tight region sub-headers for navigation.
          const useFlat = sortedRegions.length <= 1;
          return (
            <div key={lang} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {VOICE_LANG_LABELS[lang] ?? lang} <span style={{ fontWeight: 400 }}>· {flatCount}</span>
              </div>
              {useFlat ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4 }}>
                  {langStatic.map((v) => (
                    <VoiceCard
                      key={v.id}
                      title={v.label}
                      subtitle={`${v.engine}/${v.id.split("/").pop()}`}
                      regionTag={v.region}
                      gender={v.gender}
                      url={sampleUrl(v, false)}
                      reason={v.reason}
                      license={v.license}
                      licenseSource={v.licenseSource}
                      attribution={v.attribution}
                    />
                  ))}
                  {langCloned.map((c) => (
                    <VoiceCard key={c.id} title={c.name} subtitle={`f5 (clonada)`} regionTag={c.region ?? undefined} gender={c.gender === "m" ? "m" : "f"} url={`/voice-samples/f5_${c.id}.wav`} />
                  ))}
                </div>
              ) : (
                <>
                  {sortedRegions.map((region) => (
                    <div key={region} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.75 }}>
                        {VOICE_REGION_LABELS[region] ?? region} <span style={{ fontWeight: 400 }}>· {regionBuckets.get(region)!.length}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4 }}>
                        {regionBuckets.get(region)!.map((v) => (
                          <VoiceCard
                            key={v.id}
                            title={v.label}
                            subtitle={`${v.engine}/${v.id.split("/").pop()}`}
                            regionTag={v.region}
                            gender={v.gender}
                            url={sampleUrl(v, false)}
                            reason={v.reason}
                            license={v.license}
                            licenseSource={v.licenseSource}
                            attribution={v.attribution}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {langCloned.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 4 }}>
                      {langCloned.map((c) => (
                        <VoiceCard key={c.id} title={c.name} subtitle={`f5 (clonada)`} regionTag={c.region ?? undefined} gender={c.gender === "m" ? "m" : "f"} url={`/voice-samples/f5_${c.id}.wav`} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        </>
      )}
    </div>
  );
}

function EnginesLegend({ voices }: { voices: VoiceEntry[] }) {
  const [open, setOpen] = useState(false);
  const enginesPresent = useMemo(() => {
    const set = new Set<Engine>();
    for (const v of voices) set.add(v.engine);
    // Stable order: non-AR first (kokoro, piper), then AR alphabetical.
    const order: Engine[] = ["kokoro", "piper", "f5", "coqui", "bark", "elevenlabs", "chatterbox", "qwen"];
    return order.filter((e) => set.has(e));
  }, [voices]);
  if (enginesPresent.length === 0) return null;
  return (
    <div style={{ marginBottom: 4, padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid var(--card-border)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }}
      >
        <span style={{ fontSize: 10, color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Motores presentes
        </span>
        <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>· {enginesPresent.length}</span>
        {!open && (
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>
            {enginesPresent.map((e) => ENGINE_INFO[e].label.split(" (")[0]).join(", ")}
          </span>
        )}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
          {enginesPresent.map((e) => {
            const info = ENGINE_INFO[e];
            const archColor = info.architecture === "non-AR" ? "#14b8a6" : "#eab308";
            return (
              <div key={e} style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 6, borderLeft: `2px solid ${archColor}` }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{info.label}</span>
                  <span
                    style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                      background: archColor, color: "#000",
                    }}
                    title={info.architecture === "non-AR" ? "non-autoregressive: cero phantoms" : "autoregressive: phantom risk"}
                  >
                    {info.architecture}
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 14, fontSize: 10, color: "var(--foreground)", lineHeight: 1.4 }}>
                  {info.pros.map((p, i) => (
                    <li key={`p${i}`} style={{ color: "#86efac" }}>{p}</li>
                  ))}
                  {info.cons.map((c, i) => (
                    <li key={`c${i}`} style={{ color: "#fca5a5" }}>{c}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Region pill colors: subtle, semi-distinguishable so the gallery is scannable
// without becoming a rainbow. Falls back to neutral for unknown regions.
const REGION_PILL_BG: Record<string, string> = {
  ES: "rgba(245, 158, 11, 0.18)",   // amber (España)
  LATAM: "rgba(20, 184, 166, 0.18)", // teal
  MX: "rgba(132, 204, 22, 0.18)",    // lime
  CO: "rgba(59, 130, 246, 0.18)",    // blue
  AR: "rgba(168, 85, 247, 0.18)",    // violet
  PE: "rgba(244, 114, 182, 0.18)",   // pink
  CL: "rgba(239, 68, 68, 0.18)",     // red
  VE: "rgba(234, 179, 8, 0.18)",     // yellow
  PR: "rgba(14, 165, 233, 0.18)",    // sky
  BR: "rgba(34, 197, 94, 0.18)",     // green
  PT: "rgba(217, 70, 239, 0.18)",    // fuchsia
  IT: "rgba(16, 185, 129, 0.18)",    // emerald
  DE: "rgba(99, 102, 241, 0.18)",    // indigo
  FR: "rgba(56, 189, 248, 0.18)",    // light blue
  US: "rgba(148, 163, 184, 0.18)",   // slate
};
const REGION_PILL_FG: Record<string, string> = {
  ES: "#fbbf24", LATAM: "#2dd4bf", MX: "#a3e635", CO: "#60a5fa",
  AR: "#c084fc", PE: "#f9a8d4", CL: "#f87171", VE: "#facc15",
  PR: "#38bdf8", BR: "#4ade80", PT: "#e879f9", IT: "#34d399",
  DE: "#818cf8", FR: "#7dd3fc", US: "#cbd5e1",
};

// License-tier coloring: how "clean" the audio output is for a paid app.
//   green  = 100% yours, no obligations (Apache 2.0, MIT, CC0)
//   yellow = attribution required, no share-alike (CC-BY-3.0/4.0)
//   orange = attribution + share-alike viral (CC-BY-SA-4.0)
//   blue   = vendor terms, perpetual or with notice period (ElevenLabs)
//   gray   = unverified / public-domain-leaning but not formally licensed
const LICENSE_TIER: Record<LicenseCode, { bg: string; fg: string; label: string }> = {
  "Apache-2.0":          { bg: "rgba(34, 197, 94, 0.18)",  fg: "#4ade80", label: "Apache 2.0" },
  "MIT":                 { bg: "rgba(34, 197, 94, 0.18)",  fg: "#4ade80", label: "MIT" },
  "CC0":                 { bg: "rgba(34, 197, 94, 0.18)",  fg: "#4ade80", label: "CC0" },
  "CC-BY-3.0":           { bg: "rgba(234, 179, 8, 0.18)",  fg: "#facc15", label: "CC-BY 3.0" },
  "CC-BY-4.0":           { bg: "rgba(234, 179, 8, 0.18)",  fg: "#facc15", label: "CC-BY 4.0" },
  "CC-BY-SA-4.0":        { bg: "rgba(249, 115, 22, 0.20)", fg: "#fb923c", label: "CC-BY-SA 4.0" },
  "ElevenLabs-Premade":  { bg: "rgba(59, 130, 246, 0.18)", fg: "#60a5fa", label: "EL premade" },
  "ElevenLabs-Pro-2yr":  { bg: "rgba(59, 130, 246, 0.18)", fg: "#60a5fa", label: "EL pro 730d" },
  "Public-Domain":       { bg: "rgba(148, 163, 184, 0.18)", fg: "#94a3b8", label: "PD (sin verificar)" },
  "Unverified":          { bg: "rgba(148, 163, 184, 0.18)", fg: "#94a3b8", label: "sin verificar" },
};

function VoiceCard({
  title, subtitle, regionTag, gender, url, reason, license, licenseSource, attribution,
}: {
  title: string; subtitle: string; regionTag?: string; gender: "f" | "m"; url: string; reason?: string;
  license?: LicenseCode; licenseSource?: string; attribution?: string;
}) {
  const pillBg = regionTag ? REGION_PILL_BG[regionTag] ?? "rgba(148, 163, 184, 0.15)" : null;
  const pillFg = regionTag ? REGION_PILL_FG[regionTag] ?? "#94a3b8" : null;
  const lic = license ? LICENSE_TIER[license] : null;
  const licTooltip = [
    license ? `Licencia: ${license}` : null,
    licenseSource ? `Fuente: ${licenseSource}` : null,
    attribution ? `Atribución: ${attribution}` : null,
  ].filter(Boolean).join("\n");
  return (
    <div
      title={subtitle}
      style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", display: "flex", flexDirection: "column", gap: 3 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, lineHeight: 1.2 }}>
        {regionTag && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, backgroundColor: pillBg!, color: pillFg!, letterSpacing: 0.3, flexShrink: 0 }}>
            {regionTag}
          </span>
        )}
        <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
          {gender === "m" ? "M" : "F"}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, wordBreak: "break-word", flex: 1, minWidth: 0 }}>
          {title}
        </span>
      </div>
      {lic && (
        <div title={licTooltip} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, backgroundColor: lic.bg, color: lic.fg, letterSpacing: 0.2 }}>
            {lic.label}
          </span>
          {attribution && (
            <span style={{ fontSize: 8, color: "var(--muted)", fontStyle: "italic" }}>
              requiere atribución
            </span>
          )}
        </div>
      )}
      {reason && (
        <div style={{ fontSize: 9, color: "#ef4444", lineHeight: 1.25 }}>
          {reason}
        </div>
      )}
      <audio src={url} controls preload="none" style={{ width: "100%", height: 24 }} />
    </div>
  );
}

/* ───── Dialogue panel (per-row casting editor) ───── */

function DialoguePanel({
  story, voices, detection, cast, jsonDraft,
  onDetect, onCastChange, onApplyCasting, onJsonDraftChange, onSaveJson, onClear, onClose,
}: {
  story: StoryRow;
  voices: VoiceEntry[];
  detection: { segments: Array<{ speaker: string; text: string }>; speakers: string[] } | undefined;
  cast: Record<string, string>;
  jsonDraft: string;
  onDetect: () => void;
  onCastChange: (speaker: string, voiceId: string) => void;
  onApplyCasting: () => void;
  onJsonDraftChange: (v: string) => void;
  onSaveJson: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const hasExisting = !!story.dialogueSpec && story.dialogueSpec.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Multi-voz: detecta personajes en el texto, asigna una voz a cada uno, guarda y "Regenerar" usa el casting automáticamente.
        </div>
        <button onClick={() => setAdvanced((v) => !v)} style={{ ...btnSmall, fontSize: 11 }}>
          {advanced ? "Volver al modo casting" : "Modo avanzado (JSON)"}
        </button>
      </div>

      {!advanced && (
        <>
          {!detection && (
            <div style={{ padding: 12, borderRadius: 6, border: "1px dashed var(--card-border)", textAlign: "center" }}>
              <button onClick={onDetect} style={{ ...btnPrimary, fontSize: 13 }}>
                Detectar personajes en el texto
              </button>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                Lee el cuerpo de la historia y separa narrador + cada personaje en diálogos
              </div>
            </div>
          )}

          {detection && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Casting</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {detection.segments.length} segmentos · {detection.speakers.length} personajes
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={onDetect} style={{ ...btnSmall, fontSize: 11 }}>Re-detectar</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 200px) 1fr", gap: 8, alignItems: "center" }}>
                {detection.speakers.map((speaker) => {
                  const isUnknown = speaker === "?";
                  return (
                    <Fragment key={speaker}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isUnknown ? "#ef4444" : "var(--foreground)" }}>
                        {isUnknown ? "Sin atribución" : speaker}
                        {isUnknown && <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>líneas que no pudo detectar</div>}
                      </div>
                      <select
                        value={cast[speaker] ?? ""}
                        onChange={(e) => onCastChange(speaker, e.target.value)}
                        style={{ ...selectStyle, maxWidth: 320 }}
                      >
                        <option value="">— elige voz —</option>
                        {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </Fragment>
                  );
                })}
              </div>

              <details style={{ fontSize: 11, color: "var(--muted)" }}>
                <summary style={{ cursor: "pointer" }}>Ver segmentos detectados ({detection.segments.length})</summary>
                <div style={{ marginTop: 6, maxHeight: 240, overflowY: "auto", padding: 8, borderRadius: 6, border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                  {detection.segments.map((seg, i) => (
                    <div key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                      <strong style={{ color: seg.speaker === "?" ? "#ef4444" : "#14b8a6" }}>{seg.speaker}:</strong>
                      {" "}{seg.text.length > 120 ? seg.text.slice(0, 120) + "…" : seg.text}
                    </div>
                  ))}
                </div>
              </details>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={btnSmall}>Cerrar</button>
                {hasExisting && (
                  <button onClick={onClear} style={{ ...btnSmall, color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}>
                    Borrar diálogo
                  </button>
                )}
                <button
                  onClick={onApplyCasting}
                  style={{ ...btnSmall, backgroundColor: "#14b8a6", color: "#fff", borderColor: "transparent" }}
                >
                  Guardar casting
                </button>
              </div>
            </>
          )}
        </>
      )}

      {advanced && (
        <>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            JSON crudo. Útil si quieres editar segmento por segmento manualmente.
            Voces para {story.journey.language}: {voices.map((v) => v.id).join(", ")}.
          </div>
          <textarea
            value={jsonDraft || (story.dialogueSpec ? JSON.stringify(story.dialogueSpec, null, 2) : "")}
            onChange={(e) => onJsonDraftChange(e.target.value)}
            rows={10}
            spellCheck={false}
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 12,
              padding: 10,
              borderRadius: 6,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              resize: "vertical",
              minHeight: 200,
            }}
            placeholder='[\n  { "voice": "piper/es_MX-claude-high", "text": "..." }\n]'
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={btnSmall}>Cerrar</button>
            <button onClick={onSaveJson} style={{ ...btnSmall, backgroundColor: "#14b8a6", color: "#fff", borderColor: "transparent" }}>
              Guardar JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ───── Cloned voices (F5-TTS) section ───── */

const SUPPORTED_LANGUAGES_FOR_CLONING = ["spanish", "english", "german", "french", "italian", "portuguese"];

function ClonedVoicesSection({
  open, onToggle, voices, onChange, onError,
}: {
  open: boolean;
  onToggle: () => void;
  voices: ClonedVoice[];
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("spanish");
  const [region, setRegion] = useState("");
  const [gender, setGender] = useState<"f" | "m">("f");
  const [refText, setRefText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(""); setLanguage("spanish"); setRegion(""); setGender("f");
    setRefText(""); setFile(null);
  };

  const submit = async () => {
    if (!file) { onError("Sube un archivo de audio (mp3, wav o m4a) de 6-15 segundos"); return; }
    if (!name.trim()) { onError("Pon un nombre a la voz"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      fd.append("name", name);
      fd.append("language", language);
      if (region.trim()) fd.append("region", region.trim());
      fd.append("gender", gender);
      if (refText.trim()) fd.append("refText", refText.trim());
      const res = await fetch("/api/studio/audio/cloned-voices", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        onError(data?.error ? `${data.error}${data.details ? ` — ${data.details}` : ""}` : `HTTP ${res.status}`);
        return;
      }
      reset();
      onChange();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`¿Borrar la voz clonada "${name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/studio/audio/cloned-voices/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { onError(data?.error ?? `HTTP ${res.status}`); return; }
    onChange();
  };

  return (
    <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
      >
        <span style={{ fontWeight: 600 }}>Voces clonadas (F5-TTS) <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {voices.length}</span></span>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: 16, borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Sube un audio limpio de 6-15 segundos (una persona hablando, sin música ni ruido).
            La transcripción se genera automáticamente con Whisper si dejas el campo vacío.
            Generación con F5: ~5 minutos por historia.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Narrador estrella" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
              Idioma
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
                {SUPPORTED_LANGUAGES_FOR_CLONING.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
              Región (opcional)
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="MX, AR, ES…" style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
              Género
              <select value={gender} onChange={(e) => setGender(e.target.value as "f" | "m")} style={selectStyle}>
                <option value="f">Femenina</option>
                <option value="m">Masculina</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
            Audio de referencia (.mp3 / .wav / .m4a)
            <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", fontSize: 11, color: "var(--muted)", gap: 4 }}>
            Transcripción exacta (opcional — si la dejas vacía, se autogenera con Whisper)
            <textarea
              value={refText}
              onChange={(e) => setRefText(e.target.value)}
              rows={2}
              placeholder='ej: "Hola, soy Lucía y voy a leer una historia para ti."'
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => void submit()} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Procesando…" : "Subir y clonar"}
            </button>
          </div>

          {voices.length > 0 && (
            <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {voices.map((v) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 8, borderRadius: 6, border: "1px solid var(--card-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {v.language}{v.region ? ` (${v.region})` : ""} · {v.gender === "m" ? "M" : "F"}</span></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v.refText}>"{v.refText}"</div>
                  </div>
                  <code style={{ fontSize: 10, color: "var(--muted)" }}>f5/{v.id}</code>
                  <button onClick={() => void remove(v.id, v.name)} style={btnSmall}>Borrar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 32,
  padding: "0 8px",
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
};
