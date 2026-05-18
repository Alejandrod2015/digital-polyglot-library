"use client";

import { Fragment, useState, useTransition } from "react";
import MiniPlayer from "@/components/studio/MiniPlayer";
import MediaUploadField from "@/components/studio/MediaUploadField";

type Exercise = {
  id: string;
  orderIndex: number;
  type: string;
  word: string;
  sentence: string;
  audioUrl: string | null;
  payload: Record<string, unknown>;
  // Featured ones show on the end-of-story screen. The rest live in the
  // global pool the Practice tab pulls from. Editor can toggle freely.
  featured: boolean;
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

const TYPE_LABEL: Record<string, string> = {
  fill_blank: "Completa la frase",
  meaning_in_context: "Significado",
  natural_expression: "Expresión natural",
  listen_choose: "Escucha y elige",
  match_meaning: "Empareja",
};

export default function PracticeSetEditor({ storyId, storyTitle, set }: Props) {
  const [currentSet, setCurrentSet] = useState<Set | null>(set);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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

  async function toggleFeatured(exercise: Exercise) {
    const next = !exercise.featured;
    // Optimistic update so the chip flips immediately.
    setCurrentSet((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.id === exercise.id ? { ...e, featured: next } : e)) }
        : s
    );
    const res = await fetch(`/api/studio/practice-sets/${storyId}/exercises/${exercise.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
      // Roll back.
      setCurrentSet((s) =>
        s
          ? { ...s, exercises: s.exercises.map((e) => (e.id === exercise.id ? { ...e, featured: exercise.featured } : e)) }
          : s
      );
    }
  }

  async function saveExercise(updated: Exercise) {
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
    setCurrentSet((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.id === updated.id ? data.exercise : e)) }
        : s
    );
    setEditingId(null);
  }

  return (
    <div className="jm-ex">
      <header className="jm-ex__head">
        <div className="jm-ex__head-main">
          <h3 className="jm-ex__title">{storyTitle}</h3>
          <p className="jm-ex__sub">
            Pool completo de ejercicios. Los marcados como <strong>Featured</strong> aparecen al terminar la historia (10 max). Los demás viven en el pool global que la pestaña <em>Practice</em> del móvil usa por idioma. Bloquea el set cuando ya esté revisado para que la regeneración no lo sobrescriba.
          </p>
        </div>
        <div className="jm-ex__actions">
          <button
            className="jm-btn jm-btn--primary jm-btn--sm"
            onClick={() => startTransition(() => void regenerate(false))}
            disabled={pending}
          >
            {currentSet ? "Regenerar set" : "Generar set"}
          </button>
          {currentSet && (
            <>
              <button
                className="jm-btn jm-btn-tone-amber jm-btn--sm"
                onClick={() => startTransition(() => void regenerate(true))}
                disabled={pending || currentSet.locked}
              >
                Forzar regeneración
              </button>
              <button
                className={`jm-btn jm-btn--sm ${currentSet.locked ? "jm-btn-tone-teal" : ""}`}
                onClick={() => void toggleLocked()}
              >
                {currentSet.locked ? "Desbloquear" : "Bloquear (aprobado)"}
              </button>
              <span className="jm-ex__updated">
                actualizado {new Date(currentSet.updatedAt).toLocaleString()}
              </span>
            </>
          )}
        </div>
      </header>

      {error && <div className="jm-ex__error">{error}</div>}

      {!currentSet ? (
        <div className="jm-ex-empty">
          Este story no tiene un set de práctica todavía. Pulsa <strong>Generar set</strong> para crearlo desde el vocab.
        </div>
      ) : (
        <table className="jm-ex-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Featured</th>
              <th>Tipo</th>
              <th>Palabra</th>
              <th>Frase (lo que se muestra y se manda al TTS)</th>
              <th>Audio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(() => {
              const featuredCount = currentSet.exercises.filter((e) => e.featured).length;
              const FEATURED_CAP = 10;
              return currentSet.exercises.map((ex) => {
              const isEditing = editingId === ex.id;
              const canFeature = ex.featured || featuredCount < FEATURED_CAP;
              return (
                <Fragment key={ex.id}>
                  <tr className={isEditing ? "jm-ex-row--editing" : ""}>
                    <td className="jm-ex-table__num">{ex.orderIndex + 1}</td>
                    <td>
                      <button
                        type="button"
                        className={`jm-chip jm-chip--mono ${ex.featured ? "jm-chip--brand" : ""}`}
                        onClick={() => void toggleFeatured(ex)}
                        disabled={!canFeature && !ex.featured}
                        title={
                          ex.featured
                            ? "Aparece end-of-story. Click para sacar del featured."
                            : canFeature
                              ? "Solo en pool. Click para incluirlo end-of-story."
                              : `Hay ${FEATURED_CAP} featured ya. Quita uno antes de agregar otro.`
                        }
                        style={{ cursor: !canFeature && !ex.featured ? "not-allowed" : "pointer", opacity: !canFeature && !ex.featured ? 0.45 : 1, border: "none" }}
                      >
                        {ex.featured ? "★ Featured" : "Pool"}
                      </button>
                    </td>
                    <td className="jm-ex-table__type">{TYPE_LABEL[ex.type] ?? ex.type}</td>
                    <td className="jm-ex-table__word">{ex.word}</td>
                    <td>{ex.sentence}</td>
                    <td className="jm-ex-table__audio">
                      {ex.audioUrl ? (
                        <MiniPlayer src={ex.audioUrl} width={220} />
                      ) : (
                        <span className="jm-ex-table__audio-empty">pendiente</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="jm-btn--link"
                        onClick={() => setEditingId(isEditing ? null : ex.id)}
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </button>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr>
                      <td colSpan={6} className="jm-ex-edit-cell">
                        <ExerciseEditPanel
                          exercise={ex}
                          storyId={storyId}
                          locked={currentSet?.locked ?? false}
                          onCancel={() => setEditingId(null)}
                          onSave={(updated) => void saveExercise(updated)}
                          onAudioRegenerated={(updated) => {
                            setCurrentSet((s) =>
                              s
                                ? { ...s, exercises: s.exercises.map((e) => (e.id === updated.id ? updated : e)) }
                                : s
                            );
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            });
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ExerciseEditPanel({
  exercise,
  storyId,
  locked,
  onCancel,
  onSave,
  onAudioRegenerated,
}: {
  exercise: Exercise;
  storyId: string;
  locked: boolean;
  onCancel: () => void;
  onSave: (updated: Exercise) => void;
  onAudioRegenerated: (updated: Exercise) => void;
}) {
  const [sentence, setSentence] = useState(exercise.sentence);
  const [word, setWord] = useState(exercise.word);
  const [audioUrl, setAudioUrl] = useState(exercise.audioUrl ?? "");
  const [regenerating, setRegenerating] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const optionsRaw = Array.isArray((exercise.payload as { options?: unknown }).options)
    ? ((exercise.payload as { options: string[] }).options.join("\n"))
    : "";
  const [optionsText, setOptionsText] = useState(optionsRaw);
  const [answer, setAnswer] = useState(
    typeof (exercise.payload as { answer?: string }).answer === "string"
      ? (exercise.payload as { answer: string }).answer
      : exercise.word
  );

  async function regenerateAudio() {
    setAudioError(null);
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/studio/practice-sets/${storyId}/exercises/${exercise.id}/audio`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
        setAudioError(msg);
        return;
      }
      const data = (await res.json()) as { exercise: Exercise };
      setAudioUrl(data.exercise.audioUrl ?? "");
      onAudioRegenerated(data.exercise);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="jm-ex-edit">
      <div className="jm-ex-edit__head">
        <h4 className="jm-ex-edit__title">Editando ejercicio #{exercise.orderIndex + 1}</h4>
        <span className="jm-ex-edit__tag">{TYPE_LABEL[exercise.type] ?? exercise.type}</span>
      </div>

      <div className="jm-ex-edit__grid">
        <div>
          <label className="jm-field-label">Palabra</label>
          <input className="jm-input" value={word} onChange={(e) => setWord(e.target.value)} />
        </div>
        <div>
          <label className="jm-field-label">Respuesta correcta</label>
          <input className="jm-input" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </div>

        <div className="jm-ex-edit__full">
          <label className="jm-field-label">Frase (puede contener &quot;_____&quot; para fill-blank)</label>
          <textarea
            className="jm-input"
            rows={3}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
          />
        </div>

        <div className="jm-ex-edit__full">
          <label className="jm-field-label">Opciones (una por línea)</label>
          <textarea
            className="jm-input jm-input--mono"
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
          />
        </div>

        <div className="jm-ex-edit__full">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <label className="jm-field-label" style={{ margin: 0 }}>Audio</label>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="jm-btn jm-btn-tone-amber jm-btn--sm"
              onClick={() => void regenerateAudio()}
              disabled={regenerating || locked || !sentence.trim()}
              title={locked ? "Desbloquea el set para regenerar audio" : "Regenera el TTS del ejercicio usando la frase actual"}
            >
              {regenerating ? "Regenerando…" : "Regenerar audio"}
            </button>
          </div>
          <MediaUploadField
            kind="audio"
            value={audioUrl || null}
            onChange={(url) => setAudioUrl(url ?? "")}
          />
          {audioError && (
            <div className="jm-ex__error" style={{ marginTop: 8 }}>{audioError}</div>
          )}
        </div>
      </div>

      <div className="jm-ex-edit__actions">
        <button className="jm-btn jm-btn--sm" onClick={onCancel}>Cancelar</button>
        <button
          className="jm-btn jm-btn--primary jm-btn--sm"
          onClick={() => {
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
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
