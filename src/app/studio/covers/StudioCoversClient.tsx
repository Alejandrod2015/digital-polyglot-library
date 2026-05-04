"use client";

import { useEffect, useMemo, useState } from "react";

type Provider =
  | "flux"
  | "openai"
  | "gemini-imagen-4"
  | "gemini-imagen-4-ultra"
  | "gemini-flash-image"
  | "gemini-3-pro-image";
const PROVIDERS: { value: Provider; label: string; cost: string }[] = [
  { value: "flux", label: "Flux 2 Pro (BFL)", cost: "~$0.04-0.10/img" },
  { value: "openai", label: "OpenAI gpt-image-1", cost: "~$0.04/img" },
  { value: "gemini-imagen-4", label: "Gemini Imagen 4", cost: "~$0.04/img" },
  { value: "gemini-imagen-4-ultra", label: "Gemini Imagen 4 Ultra", cost: "~$0.06/img" },
  { value: "gemini-flash-image", label: "Gemini 2.5 Flash Image", cost: "más barato" },
  { value: "gemini-3-pro-image", label: "Gemini 3 Pro Image", cost: "preview" },
];

type Journey = {
  id: string;
  name: string;
  language: string;
  variant: string;
};

type Story = {
  id: string;
  slug: string | null;
  level: string;
  topic: string;
  slotIndex: number;
  status: string;
  title: string | null;
  coverUrl: string | null;
  coverDone: boolean;
};

type VariantResult = {
  variant: "cool-cartoon" | "warm-cartoon" | "earthy-cartoon";
  url: string | null;
  filename: string | null;
  error: string | null;
};

const VARIANT_LABEL: Record<VariantResult["variant"], string> = {
  "cool-cartoon": "Cool",
  "warm-cartoon": "Warm",
  "earthy-cartoon": "Earthy",
};

const VARIANT_DESCRIPTION: Record<VariantResult["variant"], string> = {
  "cool-cartoon":
    "Cartoon estilo Storyset/Freepik, paleta fría: sage, lavanda, azul polvo con saturación viva.",
  "warm-cartoon":
    "Cartoon estilo Storyset/Freepik, paleta cálida: durazno, terracota y sage con saturación viva.",
  "earthy-cartoon":
    "Cartoon estilo Storyset/Freepik, paleta terrosa: oliva, óxido, mostaza y crema.",
};

export default function StudioCoversClient() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyId, setJourneyId] = useState<string>("");
  const [stories, setStories] = useState<Story[]>([]);
  const [storyId, setStoryId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [variants, setVariants] = useState<VariantResult[] | null>(null);
  const [appliedUrl, setAppliedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>("gemini-imagen-4");
  const [usedProvider, setUsedProvider] = useState<Provider | null>(null);

  // Load journeys, default to first German.
  useEffect(() => {
    fetch("/api/studio/journeys").then((r) => r.json()).then((data: Journey[]) => {
      setJourneys(data);
      const firstGerman = data.find((j) => j.language.toLowerCase() === "german");
      if (firstGerman) setJourneyId(firstGerman.id);
      else if (data[0]) setJourneyId(data[0].id);
    }).catch((err) => setError(`Failed to load journeys: ${err}`));
  }, []);

  // Load stories when journey changes; default to first food-everyday-life A1.
  useEffect(() => {
    if (!journeyId) return;
    setStories([]);
    setStoryId("");
    setVariants(null);
    fetch(`/api/studio/journeys/stories?journeyId=${encodeURIComponent(journeyId)}`)
      .then((r) => r.json())
      .then((data: Story[]) => {
        const filtered = data.filter((s) => s.title && s.status === "published");
        setStories(filtered);
        // Default selection: food-everyday-life A1 slot 0 if present, else first published story.
        const firstFood = filtered.find(
          (s) => s.level.toLowerCase() === "a1" && s.topic === "food-everyday-life" && s.slotIndex === 0
        );
        setStoryId(firstFood?.id ?? filtered[0]?.id ?? "");
      })
      .catch((err) => setError(`Failed to load stories: ${err}`));
  }, [journeyId]);

  const selectedStory = useMemo(
    () => stories.find((s) => s.id === storyId) ?? null,
    [stories, storyId]
  );

  async function generateVariants() {
    if (!storyId) return;
    setGenerating(true);
    setVariants(null);
    setAppliedUrl(null);
    setError(null);
    try {
      const r = await fetch("/api/studio/journeys/cover-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, provider }),
      });
      if (!r.ok) {
        const text = await r.text();
        setError(`Generation failed: ${r.status} ${text.slice(0, 200)}`);
        return;
      }
      const data = await r.json();
      setVariants(data.variants ?? []);
      setUsedProvider(provider);
    } catch (err) {
      setError(`Generation error: ${err}`);
    } finally {
      setGenerating(false);
    }
  }

  async function selectVariant(url: string) {
    if (!storyId || !url) return;
    try {
      const r = await fetch("/api/studio/journeys/cover-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, selectVariantUrl: url }),
      });
      if (!r.ok) {
        const text = await r.text();
        setError(`Apply failed: ${r.status} ${text.slice(0, 200)}`);
        return;
      }
      setAppliedUrl(url);
      setStories((current) =>
        current.map((s) => (s.id === storyId ? { ...s, coverUrl: url, coverDone: true } : s))
      );
    } catch (err) {
      setError(`Apply error: ${err}`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1280 }}>
      {/* Story selector */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>Journey</span>
          <select
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            style={selectStyle}
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name || `${j.language} (${j.variant})`}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, flex: 1, minWidth: 320 }}>
          <span style={{ color: "var(--muted)" }}>Historia</span>
          <select
            value={storyId}
            onChange={(e) => setStoryId(e.target.value)}
            style={selectStyle}
          >
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.level.toUpperCase()}] {s.topic}/slot{s.slotIndex} — {s.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>Modelo</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            style={selectStyle}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} ({p.cost})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={generateVariants}
          disabled={!storyId || generating}
          style={primaryButtonStyle(generating)}
        >
          {generating ? "Generando 3 variantes…" : "Generar 3 variantes"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#fb7185", fontSize: 13, padding: 12, background: "rgba(251,113,133,0.08)", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {selectedStory?.coverUrl && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Cover actual:</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedStory.coverUrl} alt="current cover" style={{ height: 80, borderRadius: 6, border: "1px solid var(--card-border)" }} />
        </div>
      )}

      {variants && usedProvider && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Generadas con: <strong style={{ color: "var(--foreground)" }}>
            {PROVIDERS.find((p) => p.value === usedProvider)?.label ?? usedProvider}
          </strong>
        </div>
      )}

      {variants && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
          {variants.map((v) => (
            <div
              key={v.variant}
              style={{
                border: "1px solid var(--card-border)",
                borderRadius: 10,
                background: "var(--card-bg)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                outline: appliedUrl === v.url ? "2px solid #14b8a6" : "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{VARIANT_LABEL[v.variant]}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {VARIANT_DESCRIPTION[v.variant]}
                </div>
              </div>
              {v.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={v.url}
                    alt={v.variant}
                    style={{ width: "100%", aspectRatio: "3/2", objectFit: "cover", borderRadius: 6 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => selectVariant(v.url!)}
                      disabled={appliedUrl === v.url}
                      style={selectButtonStyle(appliedUrl === v.url)}
                    >
                      {appliedUrl === v.url ? "Aplicada ✓" : "Usar esta"}
                    </button>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkButtonStyle}
                    >
                      Abrir
                    </a>
                  </div>
                </>
              ) : (
                <div style={{ color: "#fb7185", fontSize: 12 }}>Falló: {v.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  background: "var(--bg-content)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
  fontSize: 13,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: disabled ? "rgba(20,184,166,0.4)" : "#14b8a6",
    color: "#fff",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function selectButtonStyle(applied: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 6,
    background: applied ? "rgba(20,184,166,0.18)" : "var(--bg-content)",
    color: applied ? "#14b8a6" : "var(--foreground)",
    border: applied ? "1px solid #14b8a6" : "1px solid var(--card-border)",
    fontSize: 12,
    fontWeight: 600,
    cursor: applied ? "default" : "pointer",
  };
}

const linkButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  background: "var(--bg-content)",
  color: "var(--foreground)",
  border: "1px solid var(--card-border)",
  fontSize: 12,
  fontWeight: 500,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};
