"use client";

import { useCallback, useEffect, useState } from "react";

// ── Styles ──

const card: React.CSSProperties = {
  padding: 14, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 12,
};
const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#14b8a6",
};
const btnPrimary: React.CSSProperties = {
  height: 28, padding: "0 14px", borderRadius: 6, border: "none",
  backgroundColor: "#14b8a6", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer",
};

// ── Types ──

type SectionAccess = Record<string, { manager: boolean; creator: boolean }>;
type Settings = { testMode: boolean; sectionAccess: SectionAccess };

const SECTIONS = [
  "Journey Manager",
  "Biblioteca",
  "Reglas pedagógicas",
];

// ── Toggle switch ──

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", padding: 2, cursor: "pointer",
        backgroundColor: checked ? "#14b8a6" : "rgba(255,255,255,0.15)", transition: "background-color 0.2s",
        display: "flex", alignItems: "center",
      }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
        transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s",
      }} />
    </button>
  );
}

// ── Component ──

export default function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/settings");
      if (res.ok) setSettings(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveSettings(updated: Settings) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/studio/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) setSaved(true);
    } finally { setSaving(false); setTimeout(() => setSaved(false), 2000); }
  }

  function setTestMode(v: boolean) {
    if (!settings) return;
    const updated = { ...settings, testMode: v };
    setSettings(updated);
    void saveSettings(updated);
  }

  function toggleAccess(section: string, role: "manager" | "creator") {
    if (!settings) return;
    const current = settings.sectionAccess[section] ?? { manager: true, creator: false };
    const updated = {
      ...settings,
      sectionAccess: {
        ...settings.sectionAccess,
        [section]: { ...current, [role]: !current[role] },
      },
    };
    setSettings(updated);
  }

  if (!settings) return <p style={{ fontSize: 11, color: "var(--muted)" }}>Cargando...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ══ Test mode ══ */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>Modo de prueba</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Genera historias muy cortas (~50 palabras, 3-5 vocab) para probar el sistema sin gastar tokens
            </p>
          </div>
          <Toggle checked={settings.testMode} onChange={setTestMode} />
        </div>
      </div>

      {/* ══ Section access ══ */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={sectionLabel}>Acceso por rol</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Admin siempre tiene acceso a todo. Configura qué secciones ven Manager y Creator.
            </p>
          </div>
          <button onClick={() => settings && void saveSettings(settings)} disabled={saving}
            style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Guardando..." : saved ? "Guardado" : "Guardar"}
          </button>
        </div>

        {/* Table header */}
        <div style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderBottom: "1px solid var(--card-border)" }}>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sección</span>
          <span style={{ width: 80, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Manager</span>
          <span style={{ width: 80, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>Creator</span>
        </div>

        {/* Rows */}
        {SECTIONS.map((section) => {
          const access = settings.sectionAccess[section] ?? { manager: true, creator: false };
          return (
            <div key={section} style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ flex: 1, fontSize: 12, color: "var(--foreground)" }}>{section}</span>
              <span style={{ width: 80, display: "flex", justifyContent: "center" }}>
                <input type="checkbox" checked={access.manager} onChange={() => toggleAccess(section, "manager")}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#14b8a6" }} />
              </span>
              <span style={{ width: 80, display: "flex", justifyContent: "center" }}>
                <input type="checkbox" checked={access.creator} onChange={() => toggleAccess(section, "creator")}
                  style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#14b8a6" }} />
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
}
