"use client";

import { useState, useTransition } from "react";

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

const TYPE_LABEL: Record<string, string> = {
  fill_blank: "Completa la frase",
  meaning_in_context: "Significado",
  natural_expression: "Expresión natural",
  listen_choose: "Escucha y elige",
  match_meaning: "Empareja",
};

export default function PracticeSetEditor({ storyId, storyTitle, set }: Props) {
  const [currentSet, setCurrentSet] = useState<Set | null>(set);
  const [editing, setEditing] = useState<Exercise | null>(null);
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
    setEditing(null);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{storyTitle}</h1>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
        Estos son los 10 ejercicios que verá el usuario al terminar la historia. Si editas alguno, queda fijo. Bloquea el
        set cuando ya esté revisado para que la regeneración no lo sobrescriba.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", alignSelf: "center" }}>
              actualizado {new Date(currentSet.updatedAt).toLocaleString()}
            </span>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#991b1b", padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {!currentSet ? (
        <div style={{ background: "#f8fafc", padding: 24, borderRadius: 8, textAlign: "center", color: "#64748b" }}>
          Este story no tiene un set de práctica todavía. Pulsa <strong>Generar set</strong> para crearlo desde el vocab.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              <th style={th}>#</th>
              <th style={th}>Tipo</th>
              <th style={th}>Palabra</th>
              <th style={th}>Frase (lo que se muestra y se manda al TTS)</th>
              <th style={th}>Audio</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {currentSet.exercises.map((ex) => (
              <tr key={ex.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={td}>{ex.orderIndex + 1}</td>
                <td style={td}>{TYPE_LABEL[ex.type] ?? ex.type}</td>
                <td style={{ ...td, fontWeight: 600 }}>{ex.word}</td>
                <td style={td}>{ex.sentence}</td>
                <td style={td}>
                  {ex.audioUrl ? (
                    <audio controls src={ex.audioUrl} style={{ height: 32, maxWidth: 220 }} preload="none" />
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>pendiente</span>
                  )}
                </td>
                <td style={td}>
                  <button onClick={() => setEditing(ex)} style={btnLink}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ExerciseEditModal
          exercise={editing}
          onCancel={() => setEditing(null)}
          onSave={(updated) => void saveExercise(updated)}
        />
      )}
    </div>
  );
}

function ExerciseEditModal({
  exercise,
  onCancel,
  onSave,
}: {
  exercise: Exercise;
  onCancel: () => void;
  onSave: (updated: Exercise) => void;
}) {
  const [sentence, setSentence] = useState(exercise.sentence);
  const [word, setWord] = useState(exercise.word);
  const [audioUrl, setAudioUrl] = useState(exercise.audioUrl ?? "");
  const optionsRaw = Array.isArray((exercise.payload as { options?: unknown }).options)
    ? ((exercise.payload as { options: string[] }).options.join("\n"))
    : "";
  const [optionsText, setOptionsText] = useState(optionsRaw);
  const [answer, setAnswer] = useState(
    typeof (exercise.payload as { answer?: string }).answer === "string"
      ? (exercise.payload as { answer: string }).answer
      : exercise.word
  );

  return (
    <div style={modalOverlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Editar ejercicio #{exercise.orderIndex + 1}</h2>
        <label style={lbl}>Palabra</label>
        <input value={word} onChange={(e) => setWord(e.target.value)} style={inp} />
        <label style={lbl}>Frase (puede contener "_____" para fill-blank)</label>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          style={{ ...inp, minHeight: 60 }}
        />
        <label style={lbl}>Opciones (una por línea)</label>
        <textarea
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
          style={{ ...inp, minHeight: 80, fontFamily: "monospace" }}
        />
        <label style={lbl}>Respuesta correcta</label>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} style={inp} />
        <label style={lbl}>URL del audio (vacío para regenerar al guardar)</label>
        <input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} style={inp} placeholder="https://...mp3" />
        {audioUrl && (
          <audio controls src={audioUrl} style={{ marginTop: 8, height: 32, width: "100%" }} preload="none" />
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCancel} style={btnSecondary}>
            Cancelar
          </button>
          <button
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
            style={btnPrimary}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles use Studio CSS vars (--background, --foreground, --card-bg,
// --card-border, --muted, --primary) so the editor renders correctly
// in both light and dark themes. Earlier version hardcoded #fff /
// #475569 / etc., which made every input text invisible in the dark
// Studio chrome (dark text on dark background).
const th: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--muted)",
};
const td: React.CSSProperties = {
  padding: "10px",
  verticalAlign: "top",
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
  background: "var(--card-bg)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
const btnLink: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--primary)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "var(--background)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 560,
  maxHeight: "90vh",
  overflowY: "auto",
};
const lbl: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--card-bg)",
  color: "var(--foreground)",
};
