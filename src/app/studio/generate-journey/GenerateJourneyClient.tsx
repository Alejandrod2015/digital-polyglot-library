"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LANGUAGES = [
  { code: "spanish", label: "Español", variants: [{ id: "latam", label: "Latam" }, { id: "spain", label: "España" }] },
  { code: "german", label: "Alemán", variants: [{ id: "germany", label: "Alemania" }, { id: "austria", label: "Austria" }] },
];

const ALL_TOPICS = [
  { slug: "community-celebrations", label: "Community & Celebrations" },
  { slug: "food-daily-life", label: "Food & Everyday Life" },
  { slug: "work-study", label: "Work & Study" },
  { slug: "travel-plans", label: "Travel & Plans" },
  { slug: "home-family", label: "Home & Family" },
  { slug: "health-wellbeing", label: "Health & Wellbeing" },
  { slug: "nature-adventure", label: "Nature & Adventure" },
  { slug: "traditions-daily-culture", label: "Traditions & Daily Culture" },
];

const LEVELS = ["a1", "a2", "b1", "b2"];

const card: React.CSSProperties = {
  padding: 14, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 10,
};

const pill = (active: boolean): React.CSSProperties => ({
  padding: "3px 10px", borderRadius: 5, border: `1px solid ${active ? "#14b8a6" : "var(--card-border)"}`,
  backgroundColor: active ? "rgba(20,184,166,0.15)" : "transparent",
  color: active ? "#14b8a6" : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer",
});

const fieldLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" as const,
};

const btnPrimary = (disabled?: boolean): React.CSSProperties => ({
  height: 32, padding: "0 16px", borderRadius: 7, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});

function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const n = new Set(set);
  if (n.has(val)) n.delete(val); else n.add(val);
  return n;
}

export default function GenerateJourneyClient() {
  const router = useRouter();
  const [journeyName, setJourneyName] = useState("German Generic");
  const [language, setLanguage] = useState("german");
  const [variant, setVariant] = useState("germany");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(["a1", "a2"]));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set(["community-celebrations", "food-daily-life", "work-study", "travel-plans"]));
  const [storiesPerTopic, setStoriesPerTopic] = useState(1);

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const total = selectedLevels.size * selectedTopics.size * storiesPerTopic;

  function createJourney() {
    // Store journey config in sessionStorage so the generate page can read it
    const config = {
      journeyName,
      language,
      variant,
      levels: Array.from(selectedLevels),
      topics: Array.from(selectedTopics),
      topicLabels: Object.fromEntries(ALL_TOPICS.map((t) => [t.slug, t.label])),
      storiesPerTopic,
    };
    sessionStorage.setItem("journeyConfig", JSON.stringify(config));
    router.push("/studio/monitor");
  }

  return (
    <div style={card}>
      {/* Row 1: Name + Language + Variant + Stories/topic */}
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Nombre</span>
          <input value={journeyName} onChange={(e) => setJourneyName(e.target.value)} placeholder="Ej: German Generic"
            style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, width: 160 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Idioma</span>
          <div style={{ display: "flex", gap: 3 }}>
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => { setLanguage(l.code); setVariant(l.variants[0].id); }} style={pill(language === l.code)}>{l.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Variante</span>
          <div style={{ display: "flex", gap: 3 }}>
            {selectedLang.variants.map((v) => (
              <button key={v.id} onClick={() => setVariant(v.id)} style={pill(variant === v.id)}>{v.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Historias/tema</span>
          <input type="number" min={1} max={4} value={storiesPerTopic} onChange={(e) => setStoriesPerTopic(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--card-border)", backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12, width: 50 }} />
        </div>
      </div>

      {/* Row 2: Levels */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={fieldLabel}>Niveles</span>
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setSelectedLevels(toggleSet(selectedLevels, l))} style={pill(selectedLevels.has(l))}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Row 3: Topics */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={fieldLabel}>Temas</span>
        {ALL_TOPICS.map((t) => (
          <button key={t.slug} onClick={() => setSelectedTopics(toggleSet(selectedTopics, t.slug))} style={pill(selectedTopics.has(t.slug))}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {selectedLevels.size} niveles x {selectedTopics.size} temas x {storiesPerTopic} = <strong style={{ color: "var(--foreground)" }}>{total} historias</strong>
        </span>
        <button onClick={createJourney} disabled={selectedLevels.size === 0 || selectedTopics.size === 0 || !journeyName.trim()}
          style={btnPrimary(selectedLevels.size === 0 || selectedTopics.size === 0 || !journeyName.trim())}>
          Crear journey
        </button>
      </div>
    </div>
  );
}
