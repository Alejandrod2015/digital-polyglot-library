"use client";

// Compact, theme-aware editor for a story's persisted practice set.
// Replaces the previous popup-modal layout with inline row expansion:
// click "Editar" on a row and an edit panel slides down underneath it,
// so editors can compare across rows without losing context.
//
// The audio cell uses a custom MiniAudioPlayer instead of the native
// <audio controls>. The browser-default widget is a hard visual scar
// against the Studio's dark editorial chrome; a small circular play
// button + progress bar matches the surrounding type system.

import { useEffect, useRef, useState, useTransition } from "react";
import {
  isDirtyPracticeSentence,
  preparePracticeSentenceForTts,
  sanitizePracticeSentence,
} from "@/lib/sanitizePracticeSentence";

type Exercise = {
  id: string;
  orderIndex: number;
  type: string;
  word: string;
  sentence: string;
  audioUrl: string | null;
  payload: Record<string, unknown>;
};

type Set = {
  id: string;
  locked: boolean;
  updatedAt: string;
  exercises: Exercise[];
};

type Props = {
  storyId: string;
  storyTitle: string;
  language: string;
  set: Set | null;
};

const TYPE_LABEL: Record<string, string> = {
  fill_blank: "Completa la frase",
  meaning_in_context: "Significado",
  natural_expression: "Expresión natural",
  listen_choose: "Escucha y elige",
  match_meaning: "Empareja",
};

// Semantic color per exercise type. The hexes are chosen for ~AA
// contrast on the navy Studio background; they reuse the palette of
// the Studio metrics tab so badges feel native here too.
const TYPE_COLOR: Record<string, string> = {
  fill_blank: "#60a5fa", // blue
  meaning_in_context: "#a78bfa", // violet
  natural_expression: "#f59e0b", // amber
  listen_choose: "#34d399", // green
  match_meaning: "#f472b6", // pink
};

export default function PracticeSetEditor({ storyId, storyTitle, language, set }: Props) {
  const [currentSet, setCurrentSet] = useState<Set | null>(set);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function regenerate(force: boolean) {
    setError(null);
    const res = await fetch(`/api/studio/practice-sets/${storyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { set: Set };
    setCurrentSet(data.set);
    setEditingId(null);
  }

  async function toggleLocked() {
    if (!currentSet) return;
    const res = await fetch(`/api/studio/practice-sets/${storyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: !currentSet.locked }),
    });
    if (!res.ok) return;
    setCurrentSet({ ...currentSet, locked: !currentSet.locked });
  }

  function applyExerciseUpdate(updated: Exercise) {
    setCurrentSet((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.id === updated.id ? updated : e)) }
        : s,
    );
  }

  async function saveExercise(updated: Exercise) {
    setError(null);
    const res = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentence: updated.sentence,
        word: updated.word,
        audioUrl: updated.audioUrl,
        payload: updated.payload,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { exercise: Exercise };
    applyExerciseUpdate(data.exercise);
    setEditingId(null);
  }

  async function regenerateExerciseAudio(ex: Exercise) {
    if (!language) {
      setError("Falta el idioma del journey para regenerar audio.");
      return;
    }
    const ttsSentence = preparePracticeSentenceForTts(ex.sentence, ex.word);
    setBusyId(ex.id);
    setError(null);
    try {
      const ttsRes = await fetch("/api/practice/sentence-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: ttsSentence, language }),
      });
      if (!ttsRes.ok) {
        const body = await ttsRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `TTS HTTP ${ttsRes.status}`);
      }
      const { url } = (await ttsRes.json()) as { url: string };
      const patch = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${ex.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: url }),
      });
      if (!patch.ok) {
        const body = await patch.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Save HTTP ${patch.status}`);
      }
      const data = (await patch.json()) as { exercise: Exercise };
      applyExerciseUpdate(data.exercise);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la regeneración de audio.");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadExerciseAudio(ex: Exercise, file: File) {
    setBusyId(ex.id);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/studio/practice-sets/${storyId}/exercises/${ex.id}/audio`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Upload HTTP ${res.status}`);
      }
      const data = (await res.json()) as { exercise: Exercise };
      applyExerciseUpdate(data.exercise);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la subida de audio.");
    } finally {
      setBusyId(null);
    }
  }

  async function clearExerciseAudio(ex: Exercise) {
    setBusyId(ex.id);
    setError(null);
    try {
      const res = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${ex.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { exercise: Exercise };
      applyExerciseUpdate(data.exercise);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo limpiar el audio.");
    } finally {
      setBusyId(null);
    }
  }

  const COL_COUNT = 6;
  const audioReadyCount = currentSet?.exercises.filter((e) => Boolean(e.audioUrl)).length ?? 0;
  const totalCount = currentSet?.exercises.length ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 16px 32px" }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0, letterSpacing: -0.2 }}>
          {storyTitle}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 0", maxWidth: 720 }}>
          {totalCount} ejercicios. Editar uno lo fija; bloquea el set cuando esté revisado para que la regeneración
          no lo sobrescriba.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <button
          onClick={() => startTransition(() => void regenerate(false))}
          disabled={pending}
          style={btnPrimary}
        >
          {currentSet ? "Regenerar set" : "Generar set"}
        </button>
        {currentSet && (
          <>
            <button
              onClick={() => startTransition(() => void regenerate(true))}
              disabled={pending || currentSet.locked}
              style={btnSecondary}
            >
              Forzar regeneración
            </button>
            <button onClick={() => void toggleLocked()} style={btnSecondary}>
              {currentSet.locked ? "🔒 Desbloquear" : "Bloquear (aprobado)"}
            </button>
            <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>
              {audioReadyCount}/{totalCount} con audio
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
              actualizado {new Date(currentSet.updatedAt).toLocaleString()}
            </span>
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            color: "#fca5a5",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 10,
            fontSize: 12,
            border: "1px solid rgba(239, 68, 68, 0.35)",
          }}
        >
          {error}
        </div>
      )}

      {!currentSet ? (
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            padding: 24,
            borderRadius: 10,
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          Este story no tiene un set de práctica todavía. Pulsa <strong>Generar set</strong> para crearlo desde
          el vocab.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--card-border)",
            borderRadius: 10,
            overflow: "hidden",
            background: "var(--card-bg)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={{ ...th, width: 150 }}>Tipo</th>
                <th style={{ ...th, width: 130 }}>Palabra</th>
                <th style={th}>Frase</th>
                <th style={{ ...th, width: 220 }}>Audio</th>
                <th style={{ ...th, width: 76 }} aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {currentSet.exercises.map((ex) => {
                const isEditing = editingId === ex.id;
                const isBusy = busyId === ex.id;
                return (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    isEditing={isEditing}
                    isBusy={isBusy}
                    locked={currentSet.locked}
                    colCount={COL_COUNT}
                    onToggleEdit={() => setEditingId(isEditing ? null : ex.id)}
                    onSave={(updated) => void saveExercise(updated)}
                    onCancel={() => setEditingId(null)}
                    onRegen={() => void regenerateExerciseAudio(ex)}
                    onUpload={(file) => void uploadExerciseAudio(ex, file)}
                    onClearAudio={() => void clearExerciseAudio(ex)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Row + expanded edit panel
// ─────────────────────────────────────────────────────────────────────

function ExerciseRow({
  exercise,
  isEditing,
  isBusy,
  locked,
  colCount,
  onToggleEdit,
  onSave,
  onCancel,
  onRegen,
  onUpload,
  onClearAudio,
}: {
  exercise: Exercise;
  isEditing: boolean;
  isBusy: boolean;
  locked: boolean;
  colCount: number;
  onToggleEdit: () => void;
  onSave: (updated: Exercise) => void;
  onCancel: () => void;
  onRegen: () => void;
  onUpload: (file: File) => void;
  onClearAudio: () => void;
}) {
  const [word, setWord] = useState(exercise.word);
  const [sentence, setSentence] = useState(exercise.sentence);
  const [audioUrl, setAudioUrl] = useState(exercise.audioUrl ?? "");
  const optionsRaw = Array.isArray((exercise.payload as { options?: unknown }).options)
    ? ((exercise.payload as { options: string[] }).options.join("\n"))
    : "";
  const [optionsText, setOptionsText] = useState(optionsRaw);
  const [answer, setAnswer] = useState(
    typeof (exercise.payload as { answer?: string }).answer === "string"
      ? (exercise.payload as { answer: string }).answer
      : exercise.word,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function resetFromProps() {
    setWord(exercise.word);
    setSentence(exercise.sentence);
    setAudioUrl(exercise.audioUrl ?? "");
    const optsNow = Array.isArray((exercise.payload as { options?: unknown }).options)
      ? ((exercise.payload as { options: string[] }).options.join("\n"))
      : "";
    setOptionsText(optsNow);
    setAnswer(
      typeof (exercise.payload as { answer?: string }).answer === "string"
        ? (exercise.payload as { answer: string }).answer
        : exercise.word,
    );
  }

  function handleSave() {
    const options = optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const newPayload: Record<string, unknown> = {
      ...exercise.payload,
      options,
      answer,
    };
    // Belt-and-suspenders: server PATCH already sanitizes, but cleaning
    // here too means the local UI updates immediately without a
    // round-trip mismatch.
    onSave({
      ...exercise,
      word,
      sentence: sanitizePracticeSentence(sentence),
      audioUrl: audioUrl.trim() || null,
      payload: newPayload,
    });
  }

  const typeColor = TYPE_COLOR[exercise.type] ?? "var(--muted)";

  return (
    <>
      <tr
        className="studio-table-row"
        style={{
          borderTop: "1px solid var(--card-border)",
          background: isEditing ? "rgba(255,255,255,0.025)" : "transparent",
        }}
      >
        <td
          style={{
            ...td,
            color: "var(--muted)",
            fontVariantNumeric: "tabular-nums",
            position: "relative",
          }}
        >
          {isEditing ? (
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: "var(--primary)",
              }}
            />
          ) : null}
          {exercise.orderIndex + 1}
        </td>
        <td style={td}>
          <TypeBadge color={typeColor}>{TYPE_LABEL[exercise.type] ?? exercise.type}</TypeBadge>
        </td>
        <td style={{ ...td, fontWeight: 600, color: "var(--foreground)" }}>
          {exercise.word || <span style={{ color: "var(--muted)" }}>—</span>}
        </td>
        <td style={{ ...td, color: "var(--foreground)", lineHeight: 1.4 }}>
          <span
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {exercise.sentence || <span style={{ color: "var(--muted)" }}>—</span>}
          </span>
        </td>
        <td style={td}>
          <MiniAudioPlayer url={exercise.audioUrl} />
        </td>
        <td style={td}>
          <button
            onClick={() => {
              if (isEditing) {
                onCancel();
              } else {
                resetFromProps();
                onToggleEdit();
              }
            }}
            style={isEditing ? btnChipActive : btnChip}
          >
            {isEditing ? "Cerrar" : "Editar"}
          </button>
        </td>
      </tr>
      {isEditing ? (
        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
          <td colSpan={colCount} style={{ padding: 0 }}>
            <div
              style={{
                padding: "16px 18px 20px",
                borderTop: "1px dashed var(--card-border)",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "14px 20px",
              }}
            >
              <Field label="Palabra">
                <input value={word} onChange={(e) => setWord(e.target.value)} style={inp} />
              </Field>
              <Field label="Respuesta correcta">
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} style={inp} />
              </Field>
              <Field label='Frase (usa "_____" para fill-blank)' span={2}>
                <textarea
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  style={{ ...inp, minHeight: 56 }}
                />
                {isDirtyPracticeSentence(sentence) ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#fbbf24",
                      background: "rgba(251, 191, 36, 0.08)",
                      border: "1px solid rgba(251, 191, 36, 0.3)",
                      padding: "6px 10px",
                      borderRadius: 6,
                      marginTop: 4,
                      lineHeight: 1.4,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>⚠ La frase termina con una comilla huérfana. Se limpiará automáticamente al guardar.</span>
                    <button
                      type="button"
                      onClick={() => setSentence(sanitizePracticeSentence(sentence))}
                      style={{
                        marginLeft: "auto",
                        background: "rgba(251, 191, 36, 0.18)",
                        border: "1px solid rgba(251, 191, 36, 0.4)",
                        color: "#fbbf24",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Limpiar ahora
                    </button>
                  </div>
                ) : null}
              </Field>
              <Field label="Opciones (una por línea)">
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  style={{
                    ...inp,
                    minHeight: 90,
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 12,
                  }}
                />
              </Field>
              <Field label="Audio">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    style={{ ...inp, fontSize: 12, fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
                    placeholder="https://...mp3"
                  />
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: "var(--background)",
                      border: "1px solid var(--card-border)",
                    }}
                  >
                    <MiniAudioPlayer url={audioUrl || exercise.audioUrl} expanded />
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={onRegen}
                      disabled={isBusy || locked}
                      style={btnSecondary}
                      title="Regenera el clip con el motor TTS y guarda la URL nueva."
                    >
                      {isBusy ? "Trabajando..." : "Regenerar audio"}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBusy || locked}
                      style={btnSecondary}
                      title="Sube tu propio mp3/wav (máx 5 MB) y reemplaza el audio actual."
                    >
                      Subir audio
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/mp4,audio/ogg,audio/webm,audio/aac"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <button
                      onClick={onClearAudio}
                      disabled={isBusy || locked || !exercise.audioUrl}
                      style={btnSecondaryDanger}
                      title="Borra la URL para que el próximo Regenerar set la rellene."
                    >
                      Quitar audio
                    </button>
                  </div>
                </div>
              </Field>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onCancel} style={btnGhost}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={isBusy || locked} style={btnPrimary}>
                  Guardar cambios
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MiniAudioPlayer — replaces native <audio controls> with a small
// circular play button + scrubber + time. Keeps the row visually quiet
// and matches the Studio chrome.
// ─────────────────────────────────────────────────────────────────────

function MiniAudioPlayer({ url, expanded }: { url: string | null | undefined; expanded?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setReady(false);
  }, [url]);

  if (!url) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            border: "1px solid var(--muted)",
            opacity: 0.5,
          }}
        />
        Sin audio
      </div>
    );
  }

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    el.currentTime = Math.max(0, Math.min(duration, duration * pct));
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remaining = Math.max(0, duration - currentTime);
  const timeLabel = formatTime(playing ? remaining : duration);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: expanded ? 36 : 28,
        width: "100%",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!ready && !playing}
        aria-label={playing ? "Pausar" : "Reproducir"}
        style={{
          width: expanded ? 32 : 28,
          height: expanded ? 32 : 28,
          minWidth: expanded ? 32 : 28,
          borderRadius: 999,
          border: "none",
          background: playing ? "var(--primary)" : "rgba(255,255,255,0.08)",
          color: playing ? "#fff" : "var(--foreground)",
          cursor: ready ? "pointer" : "wait",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s",
          padding: 0,
        }}
      >
        {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
      </button>
      <div
        onClick={seek}
        style={{
          flex: 1,
          height: 4,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 999,
          cursor: duration > 0 ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pct}%`,
            background: "var(--primary)",
            borderRadius: 999,
            transition: playing ? "width 0.1s linear" : "none",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {timeLabel}
      </span>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          if (Number.isFinite(d)) setDuration(d);
          setReady(true);
        }}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden focusable="false">
      <path d="M3 1.5 L10 6 L3 10.5 Z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden focusable="false">
      <rect x="2.5" y="1.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
      <rect x="7" y="1.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function TypeBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}1f`,
        color,
        border: `1px solid ${color}33`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: span === 2 ? "1 / -1" : undefined,
      }}
    >
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

// ─── Styles (theme-aware) ────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontWeight: 600,
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  borderBottom: "1px solid var(--card-border)",
  background: "rgba(255,255,255,0.015)",
};
const td: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
  fontSize: 13,
  color: "var(--foreground)",
};
const btnPrimary: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
  padding: "7px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};
const btnSecondaryDanger: React.CSSProperties = {
  background: "transparent",
  color: "#fca5a5",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  padding: "7px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid var(--card-border)",
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
const btnChip: React.CSSProperties = {
  background: "transparent",
  color: "var(--primary)",
  border: "1px solid var(--card-border)",
  padding: "5px 12px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
const btnChipActive: React.CSSProperties = {
  background: "var(--primary)",
  color: "#0b1e36",
  border: "1px solid var(--primary)",
  padding: "5px 12px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};
const lbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: "1px solid var(--card-border)",
  borderRadius: 7,
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--background)",
  color: "var(--foreground)",
  outline: "none",
};
