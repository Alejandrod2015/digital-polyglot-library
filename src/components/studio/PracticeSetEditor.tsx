"use client";

// Compact, theme-aware editor for a story's persisted practice set.
// Replaces the previous popup-modal layout with inline row expansion:
// click "Editar" on a row and an edit panel slides down underneath it,
// so editors can compare across rows without losing context.
//
// Audio actions per exercise (Regenerar / Subir / Quitar) live inside
// the expanded panel, alongside text/options/answer fields. Top-level
// actions (Regenerar set / Forzar / Bloquear) stay above the table.
// All colors flow through Studio CSS vars so the editor reads the
// same in light or dark chrome.

import { useRef, useState, useTransition } from "react";

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

  // Centralizes exercise state mutation so per-exercise actions (save,
  // regen, upload, clear) all funnel through one updater.
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
    // Strip the fill-blank placeholder so TTS reads the full sentence.
    const ttsSentence = ex.sentence.replace(/_+/g, ex.word);
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

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 16px 32px" }}>
      <header style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{storyTitle}</h1>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "4px 0 0", maxWidth: 720 }}>
          10 ejercicios persistidos. Editar uno lo fija; bloquea el set cuando esté revisado para que la
          regeneración no lo sobrescriba.
        </p>
      </header>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: 10,
          borderRadius: 8,
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
              {currentSet.locked ? "Desbloquear" : "Bloquear (aprobado)"}
            </button>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
              {currentSet.locked ? "🔒 bloqueado · " : ""}actualizado {new Date(currentSet.updatedAt).toLocaleString()}
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
            borderRadius: 8,
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
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--card-bg)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--card-bg)", textAlign: "left" }}>
                <th style={{ ...th, width: 36 }}>#</th>
                <th style={{ ...th, width: 130 }}>Tipo</th>
                <th style={{ ...th, width: 120 }}>Palabra</th>
                <th style={th}>Frase</th>
                <th style={{ ...th, width: 200 }}>Audio</th>
                <th style={{ ...th, width: 80 }} aria-label="Acciones" />
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

// One table row + its expanded edit panel underneath. Kept as its own
// component so the per-row local state (draft values during edit)
// doesn't trigger re-renders of sibling rows.
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

  // Re-hydrate local state from props when the row is opened / the
  // server-side audioUrl changes (e.g. after regenerate). React only
  // calls useState's initial expression on mount, so without this the
  // panel would show stale audioUrl after a server round-trip.
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
    onSave({
      ...exercise,
      word,
      sentence,
      audioUrl: audioUrl.trim() || null,
      payload: newPayload,
    });
  }

  return (
    <>
      <tr style={{ borderTop: "1px solid var(--card-border)" }} className="studio-table-row">
        <td style={{ ...td, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
          {exercise.orderIndex + 1}
        </td>
        <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>
          {TYPE_LABEL[exercise.type] ?? exercise.type}
        </td>
        <td style={{ ...td, fontWeight: 600 }}>{exercise.word || <span style={{ color: "var(--muted)" }}>—</span>}</td>
        <td style={{ ...td, color: "var(--foreground)", lineHeight: 1.35 }}>
          <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {exercise.sentence || <span style={{ color: "var(--muted)" }}>—</span>}
          </span>
        </td>
        <td style={td}>
          {exercise.audioUrl ? (
            <audio
              controls
              src={exercise.audioUrl}
              preload="none"
              style={{ height: 28, width: "100%", maxWidth: 200 }}
            />
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>sin audio</span>
          )}
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
            style={{ ...btnLink, fontWeight: 600 }}
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
                padding: "14px 16px 18px",
                borderTop: "1px solid var(--card-border)",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: "12px 18px",
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
              </Field>
              <Field label="Opciones (una por línea)">
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  style={{ ...inp, minHeight: 80, fontFamily: "var(--font-jetbrains-mono), monospace" }}
                />
              </Field>
              <Field label="Audio">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    style={inp}
                    placeholder="https://...mp3"
                  />
                  {(audioUrl || exercise.audioUrl) ? (
                    <audio
                      controls
                      src={audioUrl || exercise.audioUrl || undefined}
                      preload="none"
                      style={{ height: 32, width: "100%" }}
                    />
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={onRegen}
                      disabled={isBusy || locked}
                      style={btnSecondary}
                      title="Regenera el clip con el motor TTS y guarda la URL nueva."
                    >
                      {isBusy ? "Regenerando..." : "Regenerar audio"}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBusy || locked}
                      style={btnSecondary}
                      title="Sube tu propio mp3/wav (máx 5 MB) y reemplaza el audio actual."
                    >
                      {isBusy ? "Subiendo..." : "Subir audio"}
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
                      style={btnSecondary}
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
                  Guardar
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: span === 2 ? "1 / -1" : undefined }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles (theme-aware) ─────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 11,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  borderBottom: "1px solid var(--card-border)",
};
const td: React.CSSProperties = {
  padding: "8px 12px",
  verticalAlign: "middle",
  fontSize: 13,
  color: "var(--foreground)",
};
const btnPrimary: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  padding: "7px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  background: "var(--card-bg)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
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
  padding: "7px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};
const btnLink: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--primary)",
  cursor: "pointer",
  fontSize: 12,
  padding: "4px 6px",
};
const lbl: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--background)",
  color: "var(--foreground)",
  outline: "none",
};
