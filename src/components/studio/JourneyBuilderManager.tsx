"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import { VARIANT_OPTIONS_BY_LANGUAGE } from "@/lib/languageVariant";
import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioToast, { showToast } from "@/components/studio/StudioToast";

type Props = { plans: JourneyVariantPlan[] };

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#ec4899", "#0ea5e9"];
const LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"];
const LANGUAGES = ["Spanish", "Portuguese", "French", "Italian", "German", "Korean", "English"];

export default function JourneyBuilderManager({ plans }: Props) {
  const router = useRouter();
  const [language, setLanguage] = useState("Spanish");
  const [variantId, setVariantId] = useState("");
  const [levelsIncluded, setLevelsIncluded] = useState<string[]>(["a1", "a2"]);
  const [templateKey, setTemplateKey] = useState("empty");
  const [creating, setCreating] = useState(false);

  const templateOptions = useMemo(
    () => [
      { value: "empty", label: "Empezar vacío" },
      ...plans.map((plan) => ({
        value: `${plan.language}::${plan.variantId}`,
        label: `Duplicar ${plan.language} · ${plan.variantId.toUpperCase()}`,
      })),
    ],
    [plans]
  );

  function toggleLevel(levelId: string) {
    setLevelsIncluded((current) =>
      current.includes(levelId) ? current.filter((value) => value !== levelId) : [...current, levelId]
    );
  }

  async function createJourney() {
    const cleanVariant = variantId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanVariant) {
      showToast("Añade una variante para crear el journey.", "error");
      return;
    }
    if (!levelsIncluded.length) {
      showToast("Selecciona al menos un nivel.", "error");
      return;
    }

    setCreating(true);
    try {
      const [templateLanguage, templateVariantId] =
        templateKey !== "empty" ? templateKey.split("::") : [null, null];

      const res = await fetch("/api/studio/journey-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          variantId: cleanVariant,
          levelsIncluded,
          templateLanguage,
          templateVariantId,
        }),
      });

      if (res.status === 409) {
        showToast("Ese journey ya existe.", "error");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);

      showToast("Journey creado.", "success");
      router.push(`/studio/journey-builder/${encodeURIComponent(language)}/${encodeURIComponent(cleanVariant)}`);
    } catch (error) {
      console.error("Failed to create journey", error);
      showToast("No se pudo crear el journey. Inténtalo otra vez.", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
              Crear journey nuevo
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
              Empieza definiendo la variante, los niveles incluidos y si quieres partir de una plantilla existente.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Idioma
              </label>
              <select
                value={language}
                onChange={(event) => { setLanguage(event.target.value); setVariantId(""); }}
                style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 12px" }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Variante
              </label>
              {(() => {
                const options = VARIANT_OPTIONS_BY_LANGUAGE[language.toLowerCase()] ?? [];
                return options.length > 0 ? (
                  <select
                    value={variantId}
                    onChange={(event) => setVariantId(event.target.value)}
                    style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 12px" }}
                  >
                    <option value="">Seleccionar variante</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={variantId}
                    onChange={(event) => setVariantId(event.target.value)}
                    placeholder="Ej. latam, us, brazil"
                    style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 12px" }}
                  />
                );
              })()}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
                Niveles incluidos
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LEVELS.map((levelId) => {
                  const selected = levelsIncluded.includes(levelId);
                  return (
                    <button
                      key={levelId}
                      type="button"
                      onClick={() => toggleLevel(levelId)}
                      style={{
                        height: 34,
                        minWidth: 52,
                        borderRadius: 999,
                        border: `1px solid ${selected ? "var(--primary)" : "var(--card-border)"}`,
                        backgroundColor: selected ? "rgba(37, 99, 235, 0.15)" : "var(--background)",
                        color: selected ? "var(--primary)" : "var(--foreground)",
                        fontSize: 13,
                        fontWeight: 700,
                        padding: "0 12px",
                        cursor: "pointer",
                      }}
                    >
                      {levelId.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Punto de partida
              </label>
              <select
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
                style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid var(--card-border)", backgroundColor: "var(--background)", color: "var(--foreground)", padding: "0 12px" }}
              >
                {templateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>
                Puedes empezar vacío o duplicar una estructura ya existente para ahorrar trabajo.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              Después podrás completar niveles, topics y metas de historias dentro del journey.
            </p>
            <button
              type="button"
              onClick={() => void createJourney()}
              disabled={creating}
              className="studio-btn-primary"
              style={{
                height: 42,
                borderRadius: 10,
                border: "none",
                backgroundColor: "var(--primary)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                padding: "0 18px",
                cursor: creating ? "default" : "pointer",
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? "Creando..." : "Crear journey"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "16px 20px",
          borderRadius: 10,
          backgroundColor: "rgba(124, 58, 237, 0.08)",
          border: "1px solid rgba(124, 58, 237, 0.2)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          Journeys ya creados
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
          Aquí puedes abrir journeys existentes para ajustar niveles, topics y metas de historias. El runtime sigue usando el plan publicado con fallback al currículo antiguo si falta algo.
        </p>
      </div>

      {plans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#128736;&#65039;</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>Aún no hay journeys creados</p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Cuando crees el primero, aparecerá aquí para seguir completándolo.</p>
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {plans.map((plan, i) => {
          const color = COLORS[i % COLORS.length];
          const totalTopics = plan.levels.reduce((s, l) => s + l.topics.length, 0);
          return (
            <div
              key={`${plan.language}:${plan.variantId}`}
              className="studio-card"
              style={{
                borderRadius: 12,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                overflow: "hidden",
              }}
            >
              {/* Color top bar */}
              <div style={{ height: 4, backgroundColor: color }} />

              <div style={{ padding: 20 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                      {plan.language}
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
                      {plan.variantId.toUpperCase()} · {plan.levels.length} niveles · {totalTopics} topics
                    </p>
                  </div>
                </div>

                {/* Levels */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
                  {plan.levels.map((level) => (
                    <div
                      key={level.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: 8,
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 32,
                            height: 22,
                            borderRadius: 4,
                            backgroundColor: `${color}20`,
                            color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {level.id.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--foreground)" }}>{level.title}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{level.topics.length} topics</span>
                    </div>
                  ))}
                </div>

                <StudioActionLink
                  href={`/studio/journey-builder/${encodeURIComponent(plan.language)}/${encodeURIComponent(plan.variantId)}`}
                  pendingLabel="Abriendo journey..."
                  className="studio-btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: color,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 16,
                    border: "none",
                  }}
                >
                  Abrir journey
                </StudioActionLink>
              </div>
            </div>
          );
        })}
      </div>
      <StudioToast />
    </div>
  );
}
