"use client";

import { useState } from "react";

// ── MVP test config ──

const LANGUAGES = [
  { code: "spanish", label: "Español", variant: "latam" },
  { code: "german", label: "Alemán", variant: "germany" },
];

const TOPICS: Record<string, Record<string, string[]>> = {
  spanish: {
    a1: ["community-celebrations", "food-daily-life"],
    a2: ["work-study", "travel-plans"],
  },
  german: {
    a1: ["community-celebrations", "food-daily-life"],
    a2: ["work-study", "travel-plans"],
  },
};

const LEVELS = ["a1", "a2"];

const TOPIC_LABELS: Record<string, string> = {
  "community-celebrations": "Community & Celebrations",
  "food-daily-life": "Food & Everyday Life",
  "work-study": "Work & Study",
  "travel-plans": "Travel & Plans",
};

// ── Styles ──

const card: React.CSSProperties = {
  padding: 16, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 12,
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: "4px 12px", borderRadius: 6, border: `1px solid ${active ? "#14b8a6" : "var(--card-border)"}`,
  backgroundColor: active ? "rgba(20,184,166,0.15)" : "transparent",
  color: active ? "#14b8a6" : "var(--muted)", fontSize: 12, fontWeight: 700,
  cursor: "pointer", transition: "all 0.15s",
});

const btnPrimary: React.CSSProperties = {
  height: 36, padding: "0 20px", borderRadius: 8, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  height: 32, padding: "0 14px", borderRadius: 6, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", fontWeight: 600, fontSize: 12, cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  ...btnSecondary, borderColor: "rgba(239,68,68,0.3)", color: "#ef4444",
};

type GeneratedStory = {
  title: string;
  slug: string;
  text: string;
  synopsis: string;
  vocab: Array<{ word: string; translation?: string; type?: string; example?: string }>;
  wordCount: number;
  vocabCount: number;
};

export default function MonitorClient() {
  // Form state
  const [language, setLanguage] = useState(LANGUAGES[0].code);
  const [level, setLevel] = useState(LEVELS[0]);
  const [topic, setTopic] = useState(TOPICS[LANGUAGES[0].code][LEVELS[0]][0]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  // Cover state
  const [generatingCover, setGeneratingCover] = useState(false);
  const [coverDone, setCoverDone] = useState(false);

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const availableTopics = TOPICS[language]?.[level] ?? [];

  // When language or level changes, reset topic to first available
  function changeLanguage(code: string) {
    setLanguage(code);
    const topics = TOPICS[code]?.[level] ?? TOPICS[code]?.[LEVELS[0]] ?? [];
    setTopic(topics[0] ?? "");
    resetResult();
  }

  function changeLevel(lvl: string) {
    setLevel(lvl);
    const topics = TOPICS[language]?.[lvl] ?? [];
    setTopic(topics[0] ?? "");
    resetResult();
  }

  function resetResult() {
    setStory(null);
    setError(null);
    setPublished(null);
    setCoverDone(false);
  }

  // ── Generate ──
  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setStory(null);
    setPublished(null);
    setCoverDone(false);

    try {
      const res = await fetch("/api/studio/pipeline/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, variant: selectedLang.variant, level, topic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  // ── Publish ──
  async function handlePublish() {
    if (!story) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/studio/pipeline/publish-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: story.title,
          slug: story.slug,
          text: story.text,
          synopsis: story.synopsis,
          vocab: story.vocab,
          language,
          variant: selectedLang.variant,
          level,
          topic,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPublished(data.sanityId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  // ── Cover ──
  async function handleCover() {
    if (!published || !story) return;
    setGeneratingCover(true);
    try {
      const res = await fetch("/api/sanity/generate-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: published,
          title: story.title,
          synopsis: story.synopsis || story.text.slice(0, 500),
          language,
          region: selectedLang.variant,
          topic,
          level,
          provider: "flux",
        }),
      });
      if (!res.ok) throw new Error("Cover generation failed");
      setCoverDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingCover(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Generator form ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#14b8a6" }}>
            Generar historia
          </p>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Crea una historia para el journey
          </span>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
          {/* Language */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Idioma</span>
            <div style={{ display: "flex", gap: 4 }}>
              {LANGUAGES.map((l) => (
                <button key={l.code} onClick={() => changeLanguage(l.code)} style={pill(language === l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Nivel</span>
            <div style={{ display: "flex", gap: 4 }}>
              {LEVELS.map((l) => (
                <button key={l} onClick={() => changeLevel(l)} style={pill(level === l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Tema</span>
            <div style={{ display: "flex", gap: 4 }}>
              {availableTopics.map((t) => (
                <button key={t} onClick={() => { setTopic(t); resetResult(); }} style={pill(topic === t)}>
                  {TOPIC_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => void handleGenerate()}
            disabled={generating || !topic}
            style={{
              ...btnPrimary,
              opacity: generating || !topic ? 0.6 : 1,
              cursor: generating ? "progress" : "pointer",
              marginLeft: "auto",
            }}
          >
            {generating ? "Generando..." : "Generar historia"}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ ...card, borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.05)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>{error}</p>
        </div>
      )}

      {/* ── Result ── */}
      {story && (
        <div style={card}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--foreground)" }}>{story.title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                {story.wordCount} palabras · {story.vocabCount} vocab · {language} · {level.toUpperCase()} · {TOPIC_LABELS[topic] ?? topic}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {!published ? (
                <>
                  <button onClick={() => void handlePublish()} disabled={publishing} style={{ ...btnPrimary, opacity: publishing ? 0.6 : 1 }}>
                    {publishing ? "Publicando..." : "Publicar en Sanity"}
                  </button>
                  <button onClick={resetResult} style={btnDanger}>Descartar</button>
                </>
              ) : (
                <>
                  <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#22c55e", fontWeight: 600, gap: 4 }}>
                    Publicada
                  </span>
                  {!coverDone ? (
                    <button onClick={() => void handleCover()} disabled={generatingCover} style={{ ...btnSecondary, opacity: generatingCover ? 0.6 : 1 }}>
                      {generatingCover ? "Generando cover..." : "Generar cover"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Cover listo</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Synopsis */}
          {story.synopsis && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontStyle: "italic", borderLeft: "2px solid var(--card-border)", paddingLeft: 10 }}>
              {story.synopsis}
            </p>
          )}

          {/* Text preview */}
          <div style={{
            fontSize: 13, color: "var(--foreground)", lineHeight: 1.6,
            maxHeight: 200, overflow: "auto",
            padding: 12, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid var(--card-border)",
            whiteSpace: "pre-wrap",
          }}>
            {story.text}
          </div>

          {/* Vocab */}
          {story.vocab && story.vocab.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Vocabulario ({story.vocab.length})
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {story.vocab.map((v, i) => (
                  <span key={i} style={{
                    padding: "3px 8px", borderRadius: 4, fontSize: 11,
                    backgroundColor: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)",
                    color: "var(--foreground)",
                  }}>
                    <strong>{v.word}</strong>
                    {v.translation && <span style={{ color: "var(--muted)" }}> — {v.translation}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!story && !generating && !error && (
        <div style={{ ...card, alignItems: "center", padding: 32 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Elige idioma, nivel y tema, luego haz click en "Generar historia".<br />
            Podrás revisar el resultado antes de publicar.
          </p>
        </div>
      )}
    </div>
  );
}
