"use client";

import { useState, useEffect, useMemo } from "react";

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
  set: Set | null;
};

const TYPE_META: Record<string, { label: string; emoji: string; tint: string }> = {
  fill_blank:         { label: "Completa la frase",   emoji: "✏️", tint: "#3b82f6" },
  meaning_in_context: { label: "Significado",         emoji: "💡", tint: "#a855f7" },
  natural_expression: { label: "Expresión natural",   emoji: "🗣️", tint: "#ec4899" },
  listen_choose:      { label: "Escucha y elige",     emoji: "🎧", tint: "#06b6d4" },
  match_meaning:      { label: "Empareja",            emoji: "🧩", tint: "#f97316" },
};

const COLORS = {
  bg: "#0a1424",
  card: "#0f1e34",
  cardOpen: "#13243f",
  border: "rgba(148, 163, 184, 0.18)",
  borderStrong: "rgba(148, 163, 184, 0.35)",
  text: "#e5edf7",
  muted: "#94a3b8",
  primary: "#facc15",
  green: "#22c55e",
  red: "#fb7185",
  amber: "#f59e0b",
};

export default function PracticeSetEditor({ storyId, storyTitle, set }: Props) {
  const [currentSet, setCurrentSet] = useState<Set | null>(set);
  const [pending, setPending] = useState<string | null>(null); // operation in flight
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function regenerate(force: boolean) {
    setError(null);
    setPending(force ? "force" : "regen");
    try {
      const res = await fetch(`/api/studio/practice-sets/${storyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { set: Set };
      setCurrentSet(data.set);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  async function toggleLocked() {
    if (!currentSet) return;
    setPending("lock");
    try {
      const res = await fetch(`/api/studio/practice-sets/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentSet.locked }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { set: Set };
      setCurrentSet(data.set);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  async function saveExercise(updated: Exercise) {
    setError(null);
    setPending(`save:${updated.id}`);
    try {
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
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { exercise: Exercise };
      setCurrentSet((s) =>
        s ? { ...s, exercises: s.exercises.map((e) => (e.id === updated.id ? data.exercise : e)) } : s
      );
      setOpenId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={shell}>
      {/* Header / actions */}
      <div style={header}>
        <div>
          <h1 style={h1}>{storyTitle}</h1>
          <p style={subtitle}>
            Set persistido de práctica. {currentSet ? `${currentSet.exercises.length} ejercicios` : "Sin set generado"}.{" "}
            {currentSet && (
              <span style={{ color: COLORS.muted, fontSize: 12 }}>
                Actualizado {new Date(currentSet.updatedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {currentSet && (
            <button
              onClick={() => void toggleLocked()}
              disabled={!!pending}
              style={currentSet.locked ? btnLocked : btnGhost}
              title={currentSet.locked ? "Aprobado: protegido contra regenerar" : "Marcar como aprobado"}
            >
              {currentSet.locked ? "🔒 Aprobado" : "🔓 Borrador"}
            </button>
          )}
          <button
            onClick={() => void regenerate(!!currentSet)}
            disabled={!!pending || currentSet?.locked}
            style={btnPrimary}
            title={currentSet?.locked ? "Desbloquea para regenerar" : "Regenera todos los ejercicios desde el builder"}
          >
            {pending === "regen" || pending === "force" ? "Regenerando…" : currentSet ? "Regenerar set" : "Generar set"}
          </button>
        </div>
      </div>

      {error && (
        <div style={errBanner}>
          ✗ {error}
        </div>
      )}

      {/* Body */}
      {!currentSet ? (
        <EmptyState onGenerate={() => void regenerate(false)} pending={!!pending} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentSet.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              isOpen={openId === ex.id}
              onToggle={() => setOpenId(openId === ex.id ? null : ex.id)}
              onSave={saveExercise}
              saving={pending === `save:${ex.id}`}
              locked={currentSet.locked}
              storyId={storyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onGenerate, pending }: { onGenerate: () => void; pending: boolean }) {
  return (
    <div style={{ ...card, padding: 48, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>
        Aún no tiene set de práctica
      </h3>
      <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 20 }}>
        Genera 10 ejercicios automáticamente desde el vocab de la historia. Después puedes editarlos uno a uno.
      </p>
      <button onClick={onGenerate} disabled={pending} style={btnPrimary}>
        {pending ? "Generando…" : "Generar set"}
      </button>
    </div>
  );
}

function ExerciseCard({
  exercise,
  isOpen,
  onToggle,
  onSave,
  saving,
  locked,
  storyId,
}: {
  exercise: Exercise;
  isOpen: boolean;
  onToggle: () => void;
  onSave: (updated: Exercise) => void;
  saving: boolean;
  locked: boolean;
  storyId: string;
}) {
  const meta = TYPE_META[exercise.type] ?? { label: exercise.type, emoji: "•", tint: COLORS.muted };
  const isListening = exercise.type === "listen_choose";

  return (
    <div
      style={{
        ...card,
        background: isOpen ? COLORS.cardOpen : COLORS.card,
        borderColor: isOpen ? COLORS.borderStrong : COLORS.border,
      }}
    >
      {/* Compact header */}
      <button
        onClick={onToggle}
        style={cardHeaderBtn}
        title={isOpen ? "Contraer" : "Editar"}
      >
        <span style={{ ...orderBubble, background: meta.tint }}>{exercise.orderIndex + 1}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>{meta.emoji}</span>
            <span style={{ ...typePill, color: meta.tint, borderColor: meta.tint }}>{meta.label}</span>
            <span style={{ color: COLORS.primary, fontWeight: 700, fontSize: 14 }}>{exercise.word}</span>
          </div>
          {!isListening && (
            <div style={{ color: COLORS.muted, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {exercise.sentence}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AudioIndicator url={exercise.audioUrl} compact />
          <span style={{ color: COLORS.muted, fontSize: 12 }}>{isOpen ? "▴" : "▾"}</span>
        </div>
      </button>

      {/* Expanded edit form — `key` forces remount with fresh state. */}
      {isOpen && (
        <ExerciseEditForm
          key={exercise.id}
          exercise={exercise}
          onCancel={onToggle}
          onSave={onSave}
          saving={saving}
          locked={locked}
          storyId={storyId}
        />
      )}
    </div>
  );
}

function ExerciseEditForm({
  exercise,
  onCancel,
  onSave,
  saving,
  locked,
  storyId,
}: {
  exercise: Exercise;
  onCancel: () => void;
  onSave: (updated: Exercise) => void;
  saving: boolean;
  locked: boolean;
  storyId: string;
}) {
  const initialOptions = useMemo(() => {
    const raw = (exercise.payload as { options?: unknown }).options;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [exercise.payload]);
  const initialAnswer = useMemo(() => {
    const a = (exercise.payload as { answer?: unknown }).answer;
    return typeof a === "string" ? a : exercise.word;
  }, [exercise.payload, exercise.word]);

  const [word, setWord] = useState(exercise.word);
  const [sentence, setSentence] = useState(exercise.sentence);
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [answer, setAnswer] = useState(initialAnswer);
  const [audioUrl, setAudioUrl] = useState(exercise.audioUrl ?? "");

  // Defensive: if the parent passes a different exercise without remount
  // (e.g. data refresh), re-sync the form to the new values.
  useEffect(() => {
    setWord(exercise.word);
    setSentence(exercise.sentence);
    setOptions(initialOptions);
    setAnswer(initialAnswer);
    setAudioUrl(exercise.audioUrl ?? "");
  }, [exercise.id, exercise.audioUrl, exercise.sentence, exercise.word, initialOptions, initialAnswer]);

  const meta = TYPE_META[exercise.type] ?? { label: exercise.type, emoji: "•", tint: COLORS.muted };
  const answerInOptions = options.includes(answer);
  const sentenceHasBlank = sentence.includes("_____");
  const isFillLike = exercise.type === "fill_blank" || exercise.type === "natural_expression";
  const isListening = exercise.type === "listen_choose";

  function updateOption(idx: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      const old = next[idx];
      next[idx] = value;
      // If the changed option WAS the answer, keep it as the answer.
      if (old === answer) setAnswer(value);
      return next;
    });
  }
  function removeOption(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function submit() {
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
    const newPayload: Record<string, unknown> = { ...exercise.payload, options: cleanedOptions, answer };
    onSave({
      ...exercise,
      word: word.trim(),
      sentence: sentence.trim(),
      audioUrl: audioUrl.trim() || null,
      payload: newPayload,
    });
  }

  return (
    <div style={formBody}>
      {/* Mock preview */}
      <div style={previewWrap}>
        <div style={previewLabel}>Vista previa (cómo se ve en mobile)</div>
        <div style={previewPhone}>
          <div style={previewPrompt}>{meta.label.toUpperCase()}</div>
          {isListening ? (
            <div style={previewListenChip}>🎧 escucha la frase</div>
          ) : (
            <div style={previewSentence}>
              {sentence.split("_____").map((chunk, i, arr) => (
                <span key={i}>
                  {chunk}
                  {i < arr.length - 1 && <span style={previewBlank}>_____</span>}
                </span>
              ))}
            </div>
          )}
          <div style={previewOptionsGrid}>
            {options.length === 0 && (
              <div style={{ color: COLORS.red, fontSize: 12 }}>(sin opciones)</div>
            )}
            {options.map((opt, i) => (
              <div
                key={i}
                style={{
                  ...previewOption,
                  borderColor: opt === answer ? COLORS.green : COLORS.border,
                  background: opt === answer ? "rgba(34,197,94,0.12)" : "transparent",
                }}
              >
                {opt || <em style={{ color: COLORS.muted }}>(vacío)</em>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={fieldsCol}>
        <Field label="Palabra objetivo">
          <input value={word} onChange={(e) => setWord(e.target.value)} style={inp} disabled={locked} />
        </Field>

        <Field
          label={isFillLike ? 'Frase (usa "_____" donde va el blank)' : isListening ? "Texto a escuchar (lo que dice el audio)" : "Frase"}
          warn={isFillLike && !sentenceHasBlank ? 'Falta el marcador "_____"' : null}
        >
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            style={{ ...inp, minHeight: 64, fontFamily: "inherit" }}
            disabled={locked}
          />
        </Field>

        <Field
          label="Opciones (la verde es la correcta)"
          warn={
            options.length < 2 ? "Mínimo 2 opciones"
            : !answerInOptions ? "La respuesta correcta no está entre las opciones"
            : null
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onClick={() => setAnswer(opt)}
                  disabled={locked}
                  style={{
                    ...answerRadio,
                    background: opt === answer ? COLORS.green : "transparent",
                    borderColor: opt === answer ? COLORS.green : COLORS.borderStrong,
                  }}
                  title="Marcar como respuesta correcta"
                >
                  {opt === answer ? "✓" : ""}
                </button>
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  style={{ ...inp, flex: 1 }}
                  disabled={locked}
                />
                <button
                  onClick={() => removeOption(i)}
                  disabled={locked || options.length <= 2}
                  style={iconBtn}
                  title="Quitar"
                >
                  ×
                </button>
              </div>
            ))}
            <button onClick={addOption} disabled={locked} style={addBtn}>+ Agregar opción</button>
          </div>
        </Field>

        <Field label="Audio del ejercicio">
          <AudioField
            url={audioUrl}
            onChange={setAudioUrl}
            disabled={locked}
            storyId={storyId}
            exerciseId={exercise.id}
          />
        </Field>
      </div>

      {/* Footer */}
      <div style={footer}>
        <button onClick={onCancel} disabled={saving} style={btnGhost}>Cancelar</button>
        <button
          onClick={submit}
          disabled={saving || locked || options.length < 2 || !answerInOptions || !word.trim() || !sentence.trim()}
          style={btnPrimary}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, warn, children }: { label: string; warn?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={fieldLbl}>{label}</label>
        {warn && <span style={{ color: COLORS.amber, fontSize: 11 }}>⚠ {warn}</span>}
      </div>
      {children}
    </div>
  );
}

function AudioField({
  url,
  onChange,
  disabled,
  storyId,
  exerciseId,
}: {
  url: string;
  onChange: (v: string) => void;
  disabled: boolean;
  storyId: string;
  exerciseId: string;
}) {
  const [busy, setBusy] = useState<"regen" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      const res = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${exerciseId}/audio`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { audioUrl: string };
      onChange(data.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${exerciseId}/audio`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { audioUrl: string };
      onChange(data.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {url ? (
        <div style={audioPlayerBox}>
          <audio controls src={url} style={{ flex: 1, height: 36 }} preload="none" />
        </div>
      ) : (
        <div style={audioEmpty}>
          <span style={{ color: COLORS.muted, fontSize: 12 }}>Sin audio pre-rendido. Regenera para que use la voz del cuento, o sube uno propio.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={regenerate}
          disabled={disabled || !!busy}
          style={btnGhostSm}
          title="Genera el audio con la voz del cuento (Piper/Kokoro vía Modal)"
        >
          {busy === "regen" ? "Regenerando…" : "🔄 Regenerar con TTS"}
        </button>
        <label style={btnGhostSm}>
          {busy === "upload" ? "Subiendo…" : "📤 Subir audio propio"}
          <input
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/m4a,.mp3,.wav,.m4a"
            style={{ display: "none" }}
            disabled={disabled || !!busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
        {url && (
          <button onClick={() => onChange("")} disabled={disabled || !!busy} style={btnGhostSm}>
            Limpiar
          </button>
        )}
      </div>
      {error && <div style={{ color: COLORS.red, fontSize: 12 }}>✗ {error}</div>}
    </div>
  );
}

function AudioIndicator({ url, compact }: { url: string | null; compact?: boolean }) {
  if (!url) {
    return (
      <span style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600 }}>
        {compact ? "sin audio" : "—"}
      </span>
    );
  }
  return (
    <audio
      controls
      src={url}
      preload="none"
      style={{ height: 28, maxWidth: compact ? 180 : 240 }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─── styles ──────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: "20px 16px 64px",
  color: COLORS.text,
};
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 20,
  flexWrap: "wrap",
};
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0, marginBottom: 4 };
const subtitle: React.CSSProperties = { color: COLORS.muted, fontSize: 13, margin: 0 };
const errBanner: React.CSSProperties = {
  background: "rgba(251,113,133,0.1)",
  border: `1px solid ${COLORS.red}`,
  color: COLORS.red,
  padding: "10px 14px",
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 16,
};
const card: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  overflow: "hidden",
  transition: "background 120ms, border-color 120ms",
};
const cardHeaderBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 16px",
  width: "100%",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
};
const orderBubble: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  flexShrink: 0,
};
const typePill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
const formBody: React.CSSProperties = {
  padding: "16px 20px 20px",
  borderTop: `1px solid ${COLORS.border}`,
  display: "grid",
  gridTemplateColumns: "minmax(0, 320px) 1fr",
  gap: 20,
};
const previewWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const previewLabel: React.CSSProperties = { color: COLORS.muted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 };
const previewPhone: React.CSSProperties = {
  background: "#020617",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 16,
  fontSize: 13,
};
const previewPrompt: React.CSSProperties = { color: "#facc15", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 10 };
const previewSentence: React.CSSProperties = { color: COLORS.text, fontSize: 15, lineHeight: 1.4, marginBottom: 14 };
const previewBlank: React.CSSProperties = {
  display: "inline-block",
  minWidth: 70,
  borderBottom: "2px solid #facc15",
  color: "transparent",
  margin: "0 2px",
};
const previewListenChip: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 999,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.muted,
  marginBottom: 14,
};
const previewOptionsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};
const previewOption: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: COLORS.text,
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const fieldsCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
};
const fieldLbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: COLORS.muted, letterSpacing: 0.3 };
const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: 6,
  fontSize: 13,
  background: "#0a1424",
  color: COLORS.text,
  boxSizing: "border-box",
};
const answerRadio: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  border: "2px solid",
  cursor: "pointer",
  color: "#0a1424",
  fontWeight: 700,
  flexShrink: 0,
};
const iconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "none",
  background: "transparent",
  color: COLORS.muted,
  fontSize: 18,
  cursor: "pointer",
  flexShrink: 0,
};
const iconBtnSm: React.CSSProperties = { ...iconBtn, width: 24, height: 24, fontSize: 14 };
const addBtn: React.CSSProperties = {
  background: "transparent",
  border: `1px dashed ${COLORS.borderStrong}`,
  color: COLORS.muted,
  padding: "8px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
const audioPlayerBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#0a1424",
  border: `1px solid ${COLORS.borderStrong}`,
  borderRadius: 6,
  padding: 4,
};
const audioEmpty: React.CSSProperties = {
  background: "#0a1424",
  border: `1px dashed ${COLORS.borderStrong}`,
  borderRadius: 6,
  padding: 12,
};
const footer: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 8,
  paddingTop: 16,
  borderTop: `1px solid ${COLORS.border}`,
};
const btnPrimary: React.CSSProperties = {
  background: COLORS.primary,
  color: "#0a1424",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: COLORS.text,
  border: `1px solid ${COLORS.borderStrong}`,
  padding: "10px 18px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const btnLocked: React.CSSProperties = {
  ...btnGhost,
  background: "rgba(34,197,94,0.12)",
  borderColor: COLORS.green,
  color: COLORS.green,
};
const btnGhostSm: React.CSSProperties = {
  background: "transparent",
  color: COLORS.text,
  border: `1px solid ${COLORS.borderStrong}`,
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
