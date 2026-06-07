"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ENGINE_INFO, type AccentTag, type Engine } from "@/lib/voiceCatalog";
import { compatScore, compatBadge, type CompatScore } from "@/lib/voiceAccentCompat";
import { inferStorySetting } from "@/lib/dialogueStorySettings";

type StoryRow = {
  id: string;
  slug: string | null;
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
  accentTags?: AccentTag[];
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
  const [showDialogueCast, setShowDialogueCast] = useState(true);
  const [showCandidates, setShowCandidates] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
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
      <DialogueCastCandidatesSection
        open={showCandidates}
        onToggle={() => setShowCandidates((v) => !v)}
      />

      <DialogueCastSection
        open={showDialogueCast}
        onToggle={() => setShowDialogueCast((v) => !v)}
      />

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

      {error && (
        <div style={{ padding: 12, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!stories && <div className="studio-skeleton" style={{ height: 240 }} />}

      {stories && (
        <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <button
            onClick={() => setShowQueue((v) => !v)}
            style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
          >
            <span style={{ fontWeight: 600 }}>
              Cola de historias <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {filtered.length}</span>
              {(() => {
                const batchable = filtered.filter((s) => !s.audioUrl && SUPPORTED_LANGS.has(s.journey.language.toLowerCase())).length;
                return batchable > 0 ? <span style={{ marginLeft: 8, fontSize: 11, color: "#eab308", fontWeight: 500 }}>· lote: {batchable} pendientes</span> : null;
              })()}
            </span>
            <span style={{ color: "var(--muted)" }}>{showQueue ? "▾" : "▸"}</span>
          </button>
          {showQueue && (
          <div style={{ borderTop: "1px solid var(--card-border)", padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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
            <button onClick={() => void load()} style={btnGhost}>Recargar</button>
            <button
              onClick={() => void runBatch()}
              disabled={batchRunning || filtered.filter((s) => !s.audioUrl).length === 0}
              style={{ ...btnPrimary, opacity: batchRunning ? 0.6 : 1 }}
            >
              {batchRunning && progress ? `Generando ${progress.done}/${progress.total}` : `Generar lote (${filtered.filter((s) => !s.audioUrl && SUPPORTED_LANGS.has(s.journey.language.toLowerCase())).length})`}
            </button>
          </div>
          )}
          {showQueue && filtered.length === 0 && (
            <div style={{ borderTop: "1px solid var(--card-border)", padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              No hay historias que coincidan con el filtro.
            </div>
          )}
          {showQueue && filtered.length > 0 && (
          <div style={{ borderTop: "1px solid var(--card-border)", overflow: "hidden" }}>
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

// ─────────────────────────────────────────────────────────────────────────
// Cast aprobado para diálogos (DPL canonical voice catalog)
// ─────────────────────────────────────────────────────────────────────────
// Hardcoded copy of SPANISH_DIALOGUE_VOICES + GERMAN_DIALOGUE_VOICES from
// `src/lib/elevenlabs.ts`. We don't import elevenlabs.ts directly because
// it pulls in `crypto` / `server-only` modules that crash a client bundle.
// Keep these in sync manually when promoting a voice to the dialogue cast.
type DialogueCastVoice = {
  slot: string;       // catalog slot name (angela, horacio, …)
  voiceId: string;
  role: string;       // human-readable role this voice covers
  accent: string;     // accent + gender + age summary
  profile: string;    // short character profile / use case
  previewUrl: string; // free ElevenLabs preview MP3
};

const DIALOGUE_CAST_SPANISH: DialogueCastVoice[] = [
  {
    slot: "angela",
    voiceId: "Po9nYFo9ScA7odSuQLIW",
    role: "Narrador",
    accent: "LATAM neutral · F middle-aged",
    profile: "Mature warm narrator (poetry/documentary register).",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/5c98d742b3a64cc9ace764f1f030f624/voices/Po9nYFo9ScA7odSuQLIW/xUd7Qr2rDXUbIIUk2NlR.mp3",
  },
  {
    slot: "horacio",
    voiceId: "57D8YIbQSuE3REDPO6Vm",
    role: "Hombre adulto",
    accent: "Colombiano · M middle-aged",
    profile: "Natural + warm, paternal (don Hernán-type).",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/1da06ea679a54975ad96a2221fe6530d/voices/57D8YIbQSuE3REDPO6Vm/cab399de-2979-428d-8fff-86236bc92d22.mp3",
  },
  {
    slot: "luna",
    voiceId: "1ZhMG5ZZgJ6XpkOrB8Az",
    role: "Mujer joven",
    accent: "Colombiano · F young",
    profile: "Conversational warm friendly (Marina-type).",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/ca5aa978cbdf45d0a5bb6025dc22b785/voices/1ZhMG5ZZgJ6XpkOrB8Az/jn86qbxh2loi5B2JRMXv.mp3",
  },
  {
    slot: "alma",
    voiceId: "3ttovAt5bt3Kk38UGIob",
    role: "Mujer adulta",
    accent: "LATAM neutral · F middle-aged",
    profile: "Conversational warm (Lucía-type, sibling/peer).",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/c4a1a4b6cffe410ba65d7e02c9c25b5e/voices/3ttovAt5bt3Kk38UGIob/preview.mp3",
  },
  {
    slot: "nieve",
    voiceId: "nAFxIJGj7iSTeltygOfB",
    role: "Abuela / mamá mayor",
    accent: "Rioplatense · F old",
    profile: "Argentine grandmother: candid, determined, pleasant.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/a81cffb0e9d040f3bb0eb2db26c4603d/voices/nAFxIJGj7iSTeltygOfB/ywHX7pYF0WbKuamEHkAK.mp3",
  },
  {
    slot: "paola",
    voiceId: "PoLFkTquRWtbexdwW3Xa",
    role: "Mujer rioplatense ~45-55",
    accent: "Rioplatense · F middle-aged",
    profile: "Professional neutral versatile (alternativa más joven a Nieve).",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/968825d5b11844ebbcea86fbb7b5a642/voices/PoLFkTquRWtbexdwW3Xa/kDXWCdCiodQ12VAMe5aJ.mp3",
  },
  {
    slot: "mariana",
    voiceId: "9rvdnhrYoXoUt4igKpBw",
    role: "Mujer rioplatense con peso emocional",
    accent: "Rioplatense · F middle-aged",
    profile: "Intimate + assertive, deep clear emotional.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/L2B5JJnBamUGYrPZi70BRhGxUGo2/voices/9rvdnhrYoXoUt4igKpBw/eJt2Mk4mAxdLDY9DMynR.mp3",
  },
  {
    slot: "renzo",
    voiceId: "acHf5gp7AGOY30tJjvD4",
    role: "Hombre rioplatense joven ~25-35",
    accent: "Rioplatense · M young",
    profile: "Bold + urban, modern street-smart.",
    previewUrl: "https://api.us.elevenlabs.io/v1/voices/acHf5gp7AGOY30tJjvD4/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJjdXN0b20iLCJ3b3Jrc3BhY2VfaWQiOiIxZGEwNmVhNjc5YTU0OTc1YWQ5NmEyMjIxZmU2NTMwZCIsImZpbGVuYW1lIjoiNWY1NDVmYmItZTBhYS00ZGZlLTk1MGUtM2NhYWU5NzE2MmRiLm1wMyIsInRpbWVzdGFtcCI6MTc4MDMxMTYwMDAwMDAwMH0%3D",
  },
];

const DIALOGUE_CAST_GERMAN: DialogueCastVoice[] = [
  {
    slot: "moritz",
    voiceId: "Ww7Sq9tx9CCOiNOwWgsx",
    role: "Narrador",
    accent: "Alemán nativo · M middle-aged",
    profile: "Baritone — narrator default.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/voices/Ww7Sq9tx9CCOiNOwWgsx/preview.mp3",
  },
  {
    slot: "enniah",
    voiceId: "WHaUUVTDq47Yqc9aDbkH",
    role: "Mujer",
    accent: "Alemán nativo · F middle-aged",
    profile: "Warm — primary female.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/voices/WHaUUVTDq47Yqc9aDbkH/preview.mp3",
  },
  {
    slot: "michael",
    voiceId: "KSEa36Zojh7KLdIkb8Qu",
    role: "Joven / teen",
    accent: "Alemán nativo · M young",
    profile: "Youthful + calm narrative.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/voices/KSEa36Zojh7KLdIkb8Qu/preview.mp3",
  },
  {
    slot: "eleonore",
    voiceId: "8SdTD5IMgFKT1jp7JbPC",
    role: "Mujer mayor",
    accent: "Alemán nativo · F middle-aged",
    profile: "Mature narrator — Frau roles.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/voices/8SdTD5IMgFKT1jp7JbPC/preview.mp3",
  },
];

// Candidates pending audition. User clicks play, then approves by number in chat.
// Once approved, voice moves into SPANISH_DIALOGUE_VOICES + DIALOGUE_CAST_SPANISH
// and gets removed from this list.
type DialogueCastCandidate = {
  num: number;        // numero para que el user apruebe ("apruebo el 3, el 7…")
  name: string;       // ElevenLabs voice name as shown in their library
  voiceId: string;
  region: string;     // "Mexicano", "Chileno", "Argentino", etc.
  ageGender: string;  // "F young", "M middle-aged", "M old", etc.
  fitsRole: string;   // que personaje cubriria si se aprueba
  previewUrl: string; // free preview from /v1/shared-voices
};

const DIALOGUE_CAST_CANDIDATES: DialogueCastCandidate[] = [
  // Hueco prioritario #1: hombre mayor (abuelo) LATAM — cero voces hoy
  {
    num: 1,
    name: "Ivan - Breathy, Wise-Sounding",
    voiceId: "oqO5cdAzjE5Ik5xWIZRL",
    region: "LATAM neutral",
    ageGender: "M old",
    fitsRole: "Abuelo sabio — narrativo breathy",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/KvY1FoWUsvcW7pJIBqtQgoHlSad2/voices/oqO5cdAzjE5Ik5xWIZRL/breqON7QZP0TKZiWbprM.mp3",
  },
  {
    num: 2,
    name: "Yasser - Professional and Serious",
    voiceId: "1hB7zCGWj11SeMuBseeI",
    region: "Cubano",
    ageGender: "M old",
    fitsRole: "Abuelo caribeño — profesional sereno",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/5ce745e745794994ba2cb09963f9df13/voices/1hB7zCGWj11SeMuBseeI/61a7318f-fde0-4344-b428-e0139d39c62e.mp3",
  },
  {
    num: 3,
    name: "Benjamin - Deep, Smooth and Rich",
    voiceId: "80lPKtzJMPh1vjYMUgwe",
    region: "Mexicano",
    ageGender: "M old",
    fitsRole: "Abuelo norteño — profundo suave",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/f5ece55944454e93adeeae7c95a0bccd/voices/80lPKtzJMPh1vjYMUgwe/OdLhfMeDosUS2KjiTnPS.mp3",
  },
  // Hueco #2: F middle-aged en regiones no-rioplatenses
  {
    num: 4,
    name: "Adriana Angel - Warm, Calm & Serene",
    voiceId: "jI8zlZKtaOjhGPBV6elt",
    region: "Mexicano",
    ageGender: "F middle-aged",
    fitsRole: "Mamá en historia MX — cálida calmada serena",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/643d6ff739de47f48bc19e4fe4afd15a/voices/jI8zlZKtaOjhGPBV6elt/b3KecUcpfa1tLzBvIL2u.mp3",
  },
  {
    num: 5,
    name: "Angela (Chilean) - Warm, Calm and Assured",
    voiceId: "prblQcKOdF08ozhxP2mk",
    region: "Chileno",
    ageGender: "F middle-aged",
    fitsRole: "Mamá en historia CL — cálida segura (slot angela_cl)",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/4eEn1XHsbXPotYgXL4dl1Vkc4tp2/voices/prblQcKOdF08ozhxP2mk/205da2a0-2615-4388-afc3-ea1635f07554.mp3",
  },
  {
    num: 6,
    name: "Elena - Versátil, Natural, Cercana",
    voiceId: "dyTONAae6PhdRb3hMKPM",
    region: "Peruano",
    ageGender: "F middle-aged",
    fitsRole: "Mamá en historia Lima — versátil cercana",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/f78f937dc6ee4a439a63795ce7ff139e/voices/dyTONAae6PhdRb3hMKPM/KYUWCzwNB7uZaXav7rsL.mp3",
  },
  {
    num: 7,
    name: "Marcela - Clear and Natural Voice",
    voiceId: "ebdrtet3LErOzR0r2i60",
    region: "Colombiano",
    ageGender: "F young",
    fitsRole: "Mamá joven o hermana en historia Bogotá — clara natural profesional",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/workspace/81f58d58997f4f138c89d54f3e867004/voices/ebdrtet3LErOzR0r2i60/MmPqtEpNqIpuyP4XNOkg.mp3",
  },
  // Hueco #3: M young mexicano
  {
    num: 8,
    name: "Tom - Kind, Sincere and Calm",
    voiceId: "p1Q3ihQuPjyyENa1RGtl",
    region: "Mexicano",
    ageGender: "M young",
    fitsRole: "Hijo/teen MX — amable sincero",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/aaPjxuXAcUd7Vh0Ph6AQ6SqqhIp1/voices/p1Q3ihQuPjyyENa1RGtl/9uChkxn9F6NdRCMmjIeD.mp3",
  },
  {
    num: 9,
    name: "Nicolás Lee - Warm, Calm and Articulate",
    voiceId: "A1TMPwTwXl0r3bwjaTFc",
    region: "Mexicano",
    ageGender: "M young",
    fitsRole: "Joven adulto MX — cálido articulado",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/XDKQ0dHQAtWYQT2DVQ4macQKcKB3/voices/A1TMPwTwXl0r3bwjaTFc/dfBtrXKCTwurOqOu5BY8.mp3",
  },
  // Bonus: F young rioplatense (gap medio en region desarrollada)
  {
    num: 10,
    name: "Lucia - Warm, Expressive and Soothing",
    voiceId: "yA5jrK1S9cpCAojBYyMu",
    region: "Argentino",
    ageGender: "F young",
    fitsRole: "Hermana/peer BA — cálida expresiva (slot lucia_arg)",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/database/user/0Fxn4XyfXfQ0sQ4RXHblZGBnRP23/voices/yA5jrK1S9cpCAojBYyMu/6m8A8BPRqNphBM5Isxsv.mp3",
  },
];

function DialogueCastCandidatesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
      >
        <span style={{ fontWeight: 600 }}>
          Candidatos por evaluar <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {DIALOGUE_CAST_CANDIDATES.length}</span>
        </span>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Audiciones pendientes — dale play a cada una y dime los números aprobados en chat. Cada aprobada se mueve a <code>SPANISH_DIALOGUE_VOICES</code> + cast aprobado abajo.
          </p>
          {DIALOGUE_CAST_CANDIDATES.map((c) => (
            <div
              key={c.voiceId}
              style={{ display: "grid", gridTemplateColumns: "40px 1fr 260px", gap: 12, alignItems: "center", padding: "8px 10px", borderRadius: 8, backgroundColor: "var(--background)", border: "1px solid var(--card-border)", fontSize: 12 }}
            >
              <div style={{ fontWeight: 700, fontSize: 18, color: "var(--foreground)", textAlign: "center" }}>
                {c.num}
              </div>
              <div>
                <div style={{ color: "var(--foreground)", fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                  {c.region} · {c.ageGender} · <code style={{ fontSize: 10 }}>{c.voiceId}</code>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2, fontStyle: "italic" }}>
                  {c.fitsRole}
                </div>
              </div>
              <audio
                controls
                preload="none"
                src={c.previewUrl}
                style={{ width: 260, height: 36 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DialogueCastSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const total = DIALOGUE_CAST_SPANISH.length + DIALOGUE_CAST_GERMAN.length;
  return (
    <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <button
        onClick={onToggle}
        style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "var(--foreground)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
      >
        <span style={{ fontWeight: 600 }}>
          Cast aprobado para diálogos <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {total}</span>
        </span>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Voces canónicas para narrador y personajes en historias multi-voz. Cualquier historia generada via <code>generateAndUploadMultiVoiceAudio</code> debe casteárse exclusivamente desde este set. Para añadir o quitar voces, editar <code>SPANISH_DIALOGUE_VOICES</code> / <code>GERMAN_DIALOGUE_VOICES</code> en <code>src/lib/elevenlabs.ts</code>.
          </p>
          <DialogueCastTable lang="Spanish (LATAM)" voices={DIALOGUE_CAST_SPANISH} />
          <DialogueCastTable lang="German" voices={DIALOGUE_CAST_GERMAN} />
        </div>
      )}
    </div>
  );
}

function DialogueCastTable({ lang, voices }: { lang: string; voices: DialogueCastVoice[] }) {
  return (
    <div>
      <h4 style={{ margin: "0 0 6px 0", fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{lang}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {voices.map((v) => (
          <div
            key={v.voiceId}
            style={{ display: "grid", gridTemplateColumns: "110px 1fr 260px", gap: 12, alignItems: "center", padding: "8px 10px", borderRadius: 8, backgroundColor: "var(--background)", border: "1px solid var(--card-border)", fontSize: 12 }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{v.slot}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{v.role}</div>
            </div>
            <div>
              <div style={{ color: "var(--foreground)" }}>{v.profile}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{v.accent} · <code style={{ fontSize: 10 }}>{v.voiceId}</code></div>
            </div>
            <audio
              controls
              preload="none"
              src={v.previewUrl}
              style={{ width: 260, height: 36 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
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

  // Setting de la historia para Capa 2 (gate de casting). Si no hay
  // mapping conocido, `inferStorySetting` devuelve null y el compat
  // score cae a "unknown" — el UI no aplica restricciones.
  const storySetting = useMemo(
    () =>
      inferStorySetting({
        slug: story.slug,
        language: story.journey.language,
        variant: story.journey.variant,
      }),
    [story.slug, story.journey.language, story.journey.variant]
  );

  // Voces ordenadas por compatibility score: perfect → acceptable →
  // unknown → block. Dentro de cada bucket, alfabético por label.
  const sortedVoices = useMemo(() => {
    const order: Record<CompatScore, number> = { perfect: 0, acceptable: 1, unknown: 2, block: 3 };
    return [...voices]
      .map((v) => ({ voice: v, compat: compatScore(v.accentTags, storySetting) }))
      .sort((a, b) => {
        const oa = order[a.compat.score];
        const ob = order[b.compat.score];
        if (oa !== ob) return oa - ob;
        return a.voice.label.localeCompare(b.voice.label);
      });
  }, [voices, storySetting]);

  // Wrap del onCastChange con confirm modal cuando se elige una voz
  // con score "block" (mismatch grosero contra el setting). Voces
  // unknown/acceptable/perfect pasan directo. El usuario puede aceptar
  // explícitamente para casos legítimos (turista extranjero, etc.).
  const handleCastChange = useCallback(
    (speaker: string, voiceId: string) => {
      if (!voiceId) {
        onCastChange(speaker, voiceId);
        return;
      }
      const voice = voices.find((v) => v.id === voiceId);
      if (!voice) {
        onCastChange(speaker, voiceId);
        return;
      }
      const result = compatScore(voice.accentTags, storySetting);
      if (result.score === "block") {
        const ok = window.confirm(
          `⚠ Mismatch de acento para ${speaker}\n\n` +
            `Voz: ${voice.label}\n` +
            `Tags: ${voice.accentTags?.join(", ") ?? "(sin tags)"}\n` +
            `Setting: ${storySetting ?? "desconocido"}\n\n` +
            `${result.reason}\n\n` +
            `¿Confirmar de todos modos? (úsalo para casos como un personaje extranjero intencional)`
        );
        if (!ok) return;
      }
      onCastChange(speaker, voiceId);
    },
    [voices, storySetting, onCastChange]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Multi-voz: detecta personajes en el texto, asigna una voz a cada uno, guarda y &ldquo;Regenerar&rdquo; usa el casting automáticamente.
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
                {storySetting && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      border: "1px solid var(--card-border)",
                    }}
                    title="Setting inferido para el gate de compat de acento. Edita src/lib/dialogueStorySettings.ts para ajustar."
                  >
                    setting: {storySetting}
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={onDetect} style={{ ...btnSmall, fontSize: 11 }}>Re-detectar</button>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                🟢 match perfecto · 🟡 aceptable · ⚪ sin auditar · 🔴 no recomendado (confirma antes de aceptar)
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
                        onChange={(e) => handleCastChange(speaker, e.target.value)}
                        style={{ ...selectStyle, maxWidth: 360 }}
                      >
                        <option value="">— elige voz —</option>
                        {sortedVoices.map(({ voice: v, compat }) => {
                          const badge = compatBadge(compat.score);
                          return (
                            <option key={v.id} value={v.id}>
                              {badge.emoji} {v.label}
                            </option>
                          );
                        })}
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
                    <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v.refText}>&ldquo;{v.refText}&rdquo;</div>
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
