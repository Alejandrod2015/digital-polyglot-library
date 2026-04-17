"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LanguageOption = { id: string; code: string; label: string; variants: { id: string; code: string; label: string }[] };
type TopicOption = { id: string; slug: string; label: string };
type LevelOption = { id: string; code: string; label: string };
type JourneyTypeOption = { id: string; slug: string; label: string };

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

const selectStyle: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 5, border: "1px solid var(--card-border)",
  backgroundColor: "rgba(255,255,255,0.02)", color: "var(--foreground)", fontSize: 12,
};

function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const n = new Set(set);
  if (n.has(val)) n.delete(val); else n.add(val);
  return n;
}

export default function GenerateJourneyClient() {
  const router = useRouter();
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [journeyTypes, setJourneyTypes] = useState<JourneyTypeOption[]>([]);

  const [journeyType, setJourneyType] = useState("");
  const [language, setLanguage] = useState("");
  const [variant, setVariant] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(["a1", "a2"]));
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [storiesPerTopic, setStoriesPerTopic] = useState(1);

  const loadData = useCallback(async () => {
    const [lang, top, lev, jt] = await Promise.all([
      fetch("/api/studio/languages").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/topics").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/levels").then((r) => r.ok ? r.json() : []),
      fetch("/api/studio/journey-types").then((r) => r.ok ? r.json() : []),
    ]);
    setLanguages(lang);
    setTopics(top);
    setLevels(lev);
    setJourneyTypes(jt);
    if (lang.length && !language) {
      setLanguage(lang[0].code);
      if (lang[0].variants?.length) setVariant(lang[0].variants[0].code);
    }
  }, [language]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedLang = languages.find((l) => l.code === language);
  const total = selectedLevels.size * selectedTopics.size * storiesPerTopic;
  const selectedJourneyType = journeyTypes.find((jt) => jt.slug === journeyType);

  function createJourney() {
    const config = {
      journeyName: selectedJourneyType?.label ?? journeyType,
      journeyType,
      language,
      variant,
      levels: Array.from(selectedLevels),
      topics: Array.from(selectedTopics),
      topicLabels: Object.fromEntries(topics.map((t) => [t.slug, t.label])),
      storiesPerTopic,
    };
    sessionStorage.setItem("journeyConfig", JSON.stringify(config));
    router.push("/studio/journey-manager");
  }

  const canCreate = journeyType && language && variant && selectedLevels.size > 0 && selectedTopics.size > 0;

  return (
    <div style={card}>
      {/* Row 1: Journey Type + Language + Variant + Stories/topic */}
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Tipo de journey</span>
          <select value={journeyType} onChange={(e) => setJourneyType(e.target.value)}
            style={{ ...selectStyle, width: 160 }}>
            <option value="">Seleccionar tipo</option>
            {journeyTypes.map((jt) => (
              <option key={jt.id} value={jt.slug}>{jt.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Idioma</span>
          <select value={language} onChange={(e) => { setLanguage(e.target.value); const lang = languages.find((l) => l.code === e.target.value); if (lang?.variants?.length) setVariant(lang.variants[0].code); else setVariant(""); }}
            style={{ ...selectStyle, width: 120 }}>
            {languages.map((l) => (
              <option key={l.id} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Variante</span>
          <select value={variant} onChange={(e) => setVariant(e.target.value)}
            style={{ ...selectStyle, width: 120 }}>
            {selectedLang?.variants.map((v) => (
              <option key={v.id} value={v.code}>{v.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={fieldLabel}>Historias/tema</span>
          <input type="number" min={1} max={4} value={storiesPerTopic} onChange={(e) => setStoriesPerTopic(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ ...selectStyle, width: 50 }} />
        </div>
      </div>

      {/* Row 2: Levels */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={fieldLabel}>Niveles</span>
        {levels.map((l) => (
          <button key={l.id} onClick={() => setSelectedLevels(toggleSet(selectedLevels, l.code.toLowerCase()))} style={pill(selectedLevels.has(l.code.toLowerCase()))}>
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Row 3: Topics */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={fieldLabel}>Temas</span>
        {topics.map((t) => (
          <button key={t.id} onClick={() => setSelectedTopics(toggleSet(selectedTopics, t.slug))} style={pill(selectedTopics.has(t.slug))}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Create */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {selectedLevels.size} niveles x {selectedTopics.size} temas x {storiesPerTopic} = <strong style={{ color: "var(--foreground)" }}>{total} historias</strong>
        </span>
        <button onClick={createJourney} disabled={!canCreate}
          style={btnPrimary(!canCreate)}>
          Crear journey
        </button>
      </div>
    </div>
  );
}
