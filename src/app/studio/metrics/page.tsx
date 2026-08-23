"use client";

import { useEffect, useState } from "react";
import StudioShell from "@/components/studio/StudioShell";
import {
  ComingSoonView,
  EngagementView,
  FunnelsView,
  LearningView,
  ResumenView,
} from "@/components/studio/metrics/MetricsViews";
import {
  fmt,
  KpiCard,
} from "@/components/studio/metrics/MetricsPrimitives";
import UserDetailDrawer from "@/components/studio/metrics/UserDetailDrawer";
import type {
  DashboardData,
  MetricsSection,
  PipelineData,
} from "@/components/studio/metrics/types";
// Solo el tipo: `@/lib/metricsCohort` importa Prisma y no puede viajar al
// bundle del cliente. Las etiquetas se declaran aqui abajo.
import type { MetricsCohort } from "@/lib/metricsCohort";

/**
 * Studio · Métricas. Editorial dashboard built on the `--mx-*` token
 * layer. Resumen / Engagement / Funnels are the primary views; the
 * other seven sections are visible but de-emphasized in the tab bar
 * (they keep their existing renderers as "coming soon" cards or, in
 * the case of Audiencia and Contenido, render the data we already
 * compute).
 */

const EMPTY_DATA: DashboardData = {
  range: { from: "", to: "", days: 30 },
  kpis: {
    dau: 0,
    wau: 0,
    activeUsersInRange: 0,
    plays: 0,
    completions: 0,
    completionRate: 0,
    uniqueStories: 0,
    uniqueBooks: 0,
    avgMinutesPerActiveUser: 0,
    totalListenedMinutes: 0,
    savedStories: 0,
    savedBooks: 0,
  },
  daily: [],
  topStories: [],
  topBooks: [],
  topStoriesByMinutes: [],
  topSavedStories: [],
  topSavedBooks: [],
  signups: { total: 0, last7d: 0, last30d: 0 },
  recentSignups: [],
  trialFunnel: {
    started: 0,
    startedWithPm: 0,
    day1Active: 0,
    converted: 0,
    canceled: 0,
    conversionRate: 0,
    day1ActivationRate: 0,
    cancelRate: 0,
  },
  recentTrialStarts: [],
  recentReminderTaps: [],
  recentReminderOpens: [],
  checkoutFunnel: {
    plansViewed: 0,
    checkoutStarted: 0,
    checkoutRedirected: 0,
    checkoutFailed: 0,
    checkoutStartRate: 0,
    checkoutRedirectRate: 0,
  },
  upgradeCtaSources: [],
  journeyFunnel: {
    variantSelected: 0,
    levelSelected: 0,
    topicOpened: 0,
    nextActionClicked: 0,
    reviewCtaClicked: 0,
    checkpointRecoveryClicked: 0,
    recommendedModeOpened: 0,
    topicOpenRateFromVariant: 0,
    nextActionRateFromTopicOpen: 0,
    reviewRateFromTopicOpen: 0,
  },
  reminderFunnel: {
    scheduled: 0,
    tapped: 0,
    destinationOpened: 0,
    tapRateFromScheduled: 0,
    openRateFromTap: 0,
    destinationBreakdown: [],
  },
  audience: {
    onboardingFunnel: {
      started: 0,
      step1Completed: 0,
      step2Completed: 0,
      step3Completed: 0,
      finished: 0,
      abandoned: 0,
      levelTestStarted: 0,
      levelTestCompleted: 0,
      step1Rate: 0,
      step2Rate: 0,
      step3Rate: 0,
      finishRate: 0,
      levelTestCompleteRate: 0,
    },
    weeklyActivity: {
      activeUsersLast7Days: 0,
      usersOver5Min: 0,
      usersOver10Min: 0,
      usersOver30Min: 0,
      usersOver60Min: 0,
      activationRate10MinPct: 0,
      medianMinutes: 0,
      avgMinutesLast7Days: 0,
      distribution: [],
    },
  },
  learning: {
    practice: {
      started: 0,
      completed: 0,
      completionRate: 0,
      avgAccuracyPercent: 0,
      practicingUsers: 0,
      byMode: [],
      accuracyDistribution: [],
    },
    vocab: {
      lookups: 0,
      uniqueWords: 0,
      lookingUpUsers: 0,
      lookupsPerReader: 0,
      topWords: [],
      bySource: [],
    },
    byLanguage: [],
    byLevel: [],
    levelUnattributed: { sessions: 0, placeholder: 0, unknownStory: 0 },
  },
};

const EMPTY_PIPELINE_DATA: PipelineData = {
  agentRuns: {
    total: 0,
    byKind: { planner: 0, content: 0, qa: 0 },
    byStatus: { completed: 0, failed: 0, running: 0 },
    last7Days: [],
  },
  drafts: {
    total: 0,
    byStatus: {
      draft: 0,
      generated: 0,
      qa_pass: 0,
      qa_fail: 0,
      needs_review: 0,
      approved: 0,
      published: 0,
    },
    avgQaScore: null,
    qaPassRate: 0,
    last7Days: [],
  },
  briefs: { total: 0, pending: 0, completed: 0 },
  pipeline: { avgTimeToPublish: null, contentPerDay: 0 },
};

const PRIMARY_TABS: Array<{ key: MetricsSection; label: string }> = [
  { key: "overview", label: "Resumen" },
  { key: "engagement", label: "Engagement" },
  { key: "funnels", label: "Funnels" },
];

const MUTED_TABS: Array<{ key: MetricsSection; label: string; icon: string }> = [
  { key: "acquisition", label: "Adquisición", icon: "↗" },
  { key: "audience", label: "Audiencia", icon: "◍" },
  { key: "content", label: "Contenido", icon: "≡" },
  { key: "learning", label: "Aprendizaje", icon: "✓" },
  { key: "experiments", label: "Experimentos", icon: "⚗" },
  { key: "alerts", label: "Alertas", icon: "!" },
  { key: "exports", label: "Exportaciones", icon: "↧" },
];

const RANGE_OPTIONS = ["7", "30", "90", "180"];

/**
 * Quién produjo los números. El eje es la persona, no la plataforma: un beta
 * tester que además abre el lector web sigue siendo beta. "Público" es todo
 * el que no está en el programa, compre libros o no.
 */
const COHORT_OPTIONS: Array<{ key: MetricsCohort; label: string; title: string }> = [
  { key: "all", label: "Todos", title: "Beta y público juntos" },
  { key: "beta", label: "Beta", title: "Solo los testers del programa (invited / accepted)" },
  {
    key: "public",
    label: "Público",
    title: "Todo el que no está en la beta: compradores de libros y altas libres",
  },
];

/** Secciones que no salen de eventos de usuario, así que no admiten cohorte. */
const COHORT_BLIND_SECTIONS: MetricsSection[] = ["content"];

function formatRangeLabel(from: string, to: string) {
  if (!from || !to) return "-";
  return `${from.slice(0, 10)} → ${to.slice(0, 10)}`;
}

export default function MetricsDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [pipelineData, setPipelineData] =
    useState<PipelineData>(EMPTY_PIPELINE_DATA);
  const [sectionCache, setSectionCache] = useState<
    Partial<Record<MetricsSection, DashboardData>>
  >({});
  const [days, setDays] = useState("30");
  // Rango personalizado: cuando `customFrom` y `customTo` están seteados,
  // la API recibe `from`/`to` en vez de `days`. El preset queda visible
  // pero ninguno aparece como "active" (gestión por el `isCustom` flag).
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const isCustom = customFrom !== "" && customTo !== "";
  const [bookSlug, setBookSlug] = useState("");
  const [storySlug, setStorySlug] = useState("");
  const [cohort, setCohort] = useState<MetricsCohort>("all");
  const [section, setSection] = useState<MetricsSection>("overview");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadPipelineMetrics() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/metrics/pipeline");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as PipelineData;
      setPipelineData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const message = msg.includes("403")
        ? "No tienes acceso a métricas."
        : `No se pudieron cargar las métricas de pipeline: ${msg}`;
      setErrorMessage(message);
      console.error("Error loading pipeline metrics:", err);
      setPipelineData(EMPTY_PIPELINE_DATA);
    } finally {
      setLoading(false);
    }
  }

  async function loadMetrics(
    targetSection: MetricsSection = section,
    force = false
  ) {
    if (targetSection === "content") {
      return loadPipelineMetrics();
    }
    if (!force && sectionCache[targetSection]) {
      setData(sectionCache[targetSection] ?? EMPTY_DATA);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const qs = new URLSearchParams();
      qs.set("section", targetSection);
      if (isCustom) {
        // Pasar ISO strings; el route handler hace parseDate(). Si la API
        // recibe ambos `from` y `to`, ignora `days`. Calculamos un `days`
        // aproximado para que el chart no degenere.
        qs.set("from", new Date(customFrom).toISOString());
        qs.set("to", new Date(`${customTo}T23:59:59`).toISOString());
        const ms =
          new Date(customTo).getTime() - new Date(customFrom).getTime();
        qs.set("days", String(Math.max(1, Math.round(ms / 86400000) + 1)));
      } else {
        qs.set("days", days);
      }
      if (bookSlug.trim()) qs.set("bookSlug", bookSlug.trim());
      if (storySlug.trim()) qs.set("storySlug", storySlug.trim());
      qs.set("cohort", cohort);
      const res = await fetch(`/api/metrics/dashboard?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as DashboardData;
      setSectionCache((c) => ({ ...c, [targetSection]: json }));
      setData(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const message = msg.includes("403")
        ? "No tienes acceso a métricas."
        : `No se pudieron cargar las métricas: ${msg}`;
      setErrorMessage(message);
      console.error("Error loading metrics dashboard:", err);
      setData(EMPTY_DATA);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (section === "content") {
      void loadPipelineMetrics();
      return;
    }
    if (sectionCache[section]) {
      setData(sectionCache[section] ?? EMPTY_DATA);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        void loadMetrics(section);
      });
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // Cuando cambia un filtro, invalidamos cache y disparamos refetch
  // automático. NO reseteamos `data` a EMPTY_DATA; mantenemos los
  // números viejos visibles mientras la nueva fetch carga (el spinner
  // del botón "Actualizar" indica el cambio en curso). Excepción: cuando
  // se está editando un rango personalizado a medias (solo una fecha
  // seteada) no refetchea, espera a tener ambos o ninguno.
  useEffect(() => {
    const customIncomplete =
      (customFrom !== "" && customTo === "") ||
      (customFrom === "" && customTo !== "");
    if (customIncomplete) return;
    setSectionCache({});
    void loadMetrics(section, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookSlug, days, storySlug, customFrom, customTo, cohort]);

  function handleExport() {
    const qs = new URLSearchParams();
    qs.set("section", section);
    if (isCustom) {
      qs.set("from", new Date(customFrom).toISOString());
      qs.set("to", new Date(`${customTo}T23:59:59`).toISOString());
      const ms =
        new Date(customTo).getTime() - new Date(customFrom).getTime();
      qs.set("days", String(Math.max(1, Math.round(ms / 86400000) + 1)));
    } else {
      qs.set("days", days);
    }
    if (bookSlug.trim()) qs.set("bookSlug", bookSlug.trim());
    if (storySlug.trim()) qs.set("storySlug", storySlug.trim());
    qs.set("cohort", cohort);
    window.location.href = `/api/metrics/export?${qs.toString()}`;
  }

  function renderActiveSection() {
    if (section === "overview") return <ResumenView data={data} />;
    if (section === "engagement") return <EngagementView data={data} />;
    if (section === "funnels") return <FunnelsView data={data} />;

    if (section === "audience") {
      return <AudienceView data={data} />;
    }
    if (section === "content") {
      return <ContentView data={pipelineData} />;
    }
    if (section === "acquisition") {
      return <AcquisitionView data={data} cohort={cohort} />;
    }
    if (section === "learning") {
      return <LearningView learning={data.learning} />;
    }
    if (section === "experiments") {
      return (
        <ComingSoonView
          title="Experimentos"
          description="Compara variantes A/B para covers, títulos, CTAs y copy del paywall."
        />
      );
    }
    if (section === "alerts") {
      return (
        <ComingSoonView
          title="Alertas"
          description="Umbrales para caídas de completion rate, anomalías de tráfico y fallos de pipeline o API."
        />
      );
    }
    return (
      <ComingSoonView
        title="Exportaciones"
        description="Exporta snapshots semanales y conecta BI tools (Looker Studio, Metabase) con credenciales read-only."
      />
    );
  }

  const periodLabel = formatRangeLabel(data.range.from, data.range.to);

  return (
    <StudioShell
      title="Métricas"
      description="Cómo se comportan tus historias, libros, journeys y recordatorios."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Métricas" },
      ]}
    >
      <div className="mx-root" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--mx-muted)",
              maxWidth: 720,
            }}
          >
            Últimos {data.range.days} días{" "}
            <span className="mx-mono" style={{ color: "var(--mx-fg-soft)" }}>
              {periodLabel}
            </span>
          </p>
          <span className="mx-live">
            <span className="mx-live__dot" />
            Datos en vivo · actualizado{" "}
            <span className="mx-mono" style={{ marginLeft: 4 }}>
              ahora
            </span>
          </span>
        </div>

        {cohort !== "all" && COHORT_BLIND_SECTIONS.includes(section) ? (
          // Esta sección no sale de eventos de usuario (el pipeline editorial
          // no tiene a quién atribuirle nada), así que el filtro se dice en
          // voz alta en vez de fingir que se aplicó.
          <div
            className="mx-panel"
            style={{ padding: "8px 12px", fontSize: 12, color: "var(--mx-muted)" }}
          >
            El filtro de cohorte no aplica aquí: estos números salen del
            pipeline editorial, no de lo que hace la gente en la app.
          </div>
        ) : null}

        <form
          autoComplete="off"
          className="mx-filters"
          onSubmit={(e) => {
            e.preventDefault();
            void loadMetrics(section, true);
          }}
        >
          <div className="mx-filters__group">
            <span className="mx-filters__label">Rango</span>
            <div className="mx-segmented">
              {RANGE_OPTIONS.map((option) => {
                const active = option === days && !isCustom;
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => {
                      setDays(option);
                      setCustomFrom("");
                      setCustomTo("");
                    }}
                    className={
                      active
                        ? "mx-segmented__btn mx-segmented__btn--active"
                        : "mx-segmented__btn"
                    }
                  >
                    {option}d
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-filters__group">
            <span className="mx-filters__label">Cohorte</span>
            <div className="mx-segmented">
              {COHORT_OPTIONS.map((option) => {
                const active = option.key === cohort;
                return (
                  <button
                    type="button"
                    key={option.key}
                    title={option.title}
                    onClick={() => setCohort(option.key)}
                    className={
                      active
                        ? "mx-segmented__btn mx-segmented__btn--active"
                        : "mx-segmented__btn"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-filters__group">
            <span className="mx-filters__label">Personalizado</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Desde"
              className="mx-date-input"
              style={{
                background: "var(--mx-bg-input)",
                border: "1px solid var(--mx-border)",
                borderRadius: 7,
                padding: "5px 8px",
                color: "var(--mx-fg)",
                fontSize: 12,
                fontFamily: "var(--mx-mono)",
                outline: "none",
                colorScheme: "dark",
              }}
            />
            <span style={{ color: "var(--mx-muted)", fontSize: 12 }}>→</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="Hasta"
              className="mx-date-input"
              style={{
                background: "var(--mx-bg-input)",
                border: "1px solid var(--mx-border)",
                borderRadius: 7,
                padding: "5px 8px",
                color: "var(--mx-fg)",
                fontSize: 12,
                fontFamily: "var(--mx-mono)",
                outline: "none",
                colorScheme: "dark",
              }}
            />
            {isCustom && (
              <button
                type="button"
                className="mx-input__clear"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
                title="Volver al rango preestablecido"
                aria-label="Limpiar rango personalizado"
              >
                ×
              </button>
            )}
          </div>

          <div className="mx-filters__group mx-filters__group--input">
            <span className="mx-filters__label">Libro</span>
            <div className="mx-input">
              <span className="mx-input__icon">⌕</span>
              <input
                value={bookSlug}
                onChange={(e) => setBookSlug(e.target.value)}
                placeholder="bookSlug"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
              {bookSlug && (
                <button
                  type="button"
                  className="mx-input__clear"
                  onClick={() => setBookSlug("")}
                  aria-label="Limpiar libro"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="mx-filters__group mx-filters__group--input">
            <span className="mx-filters__label">Historia</span>
            <div className="mx-input">
              <span className="mx-input__icon">⌕</span>
              <input
                value={storySlug}
                onChange={(e) => setStorySlug(e.target.value)}
                placeholder="storySlug"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
              />
              {storySlug && (
                <button
                  type="button"
                  className="mx-input__clear"
                  onClick={() => setStorySlug("")}
                  aria-label="Limpiar historia"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <span className="mx-filters__spacer" />

          <div className="mx-filters__actions">
            <button
              type="button"
              className="mx-btn"
              onClick={handleExport}
              title="Exporta el rango actual como CSV"
            >
              ⤓ Exportar
            </button>
            <button
              type="submit"
              className="mx-btn mx-btn--primary"
              disabled={loading}
            >
              {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div className="mx-tabs">
          <div className="mx-tabs__main">
            {PRIMARY_TABS.map((tab) => {
              const active = tab.key === section;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setSection(tab.key)}
                  className={active ? "mx-tab mx-tab--active" : "mx-tab"}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="mx-tabs__more">
            {MUTED_TABS.map((tab) => {
              const active = tab.key === section;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => setSection(tab.key)}
                  className={
                    active
                      ? "mx-tab mx-tab--muted mx-tab--active"
                      : "mx-tab mx-tab--muted"
                  }
                >
                  <span className="mx-tab__icon">{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div key={section}>{renderActiveSection()}</div>
      </div>
    </StudioShell>
  );
}

// ── Audience view (preserves the funnel + activation rate work) ──
function AudienceView({ data }: { data: DashboardData }) {
  const ob = data.audience.onboardingFunnel;
  const wk = data.audience.weeklyActivity;
  const maxBucketUsers = Math.max(
    1,
    ...wk.distribution.map((b) => b.users)
  );
  return (
    <div className="mx-view">
      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Onboarding</div>
            <h3 className="mx-panel__title">Drop-off por paso</h3>
          </div>
          <span className="mx-panel__hint">
            cuenta solo desde el deploy del tracking
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Started" value={ob.started} />
          <KpiCard
            label="Step 1 → 2"
            value={ob.step1Completed}
            hint={`${ob.step1Rate}% del start`}
          />
          <KpiCard
            label="Step 2 → 3"
            value={ob.step2Completed}
            hint={`${ob.step2Rate}% del start`}
          />
          <KpiCard
            label="Step 3 → 4"
            value={ob.step3Completed}
            hint={`${ob.step3Rate}% del start`}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginTop: 10,
          }}
        >
          <KpiCard
            label="Finished"
            value={ob.finished}
            accent="xp"
            hint={`${ob.finishRate}% completion`}
          />
          <KpiCard label="Abandoned (step 1)" value={ob.abandoned} />
          <KpiCard label="Level test started" value={ob.levelTestStarted} />
          <KpiCard
            label="Level test completed"
            value={ob.levelTestCompleted}
            accent="cyan"
            hint={`${ob.levelTestCompleteRate}% pass-through`}
          />
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Weekly activation</div>
            <h3 className="mx-panel__title">Últimos 7 días</h3>
          </div>
          <span className="mx-panel__hint">
            ≥10 min/sem = activation rate
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Active users (7d)" value={wk.activeUsersLast7Days} />
          <KpiCard
            label="≥10 min/sem"
            value={wk.usersOver10Min}
            accent="xp"
            hint={`${wk.activationRate10MinPct}% activation rate`}
          />
          <KpiCard
            label="Avg min/user"
            value={wk.avgMinutesLast7Days}
            accent="gold"
          />
          <KpiCard
            label="Median min/user"
            value={wk.medianMinutes}
            accent="gold"
          />
        </div>

        <div className="mx-panel__sub">Distribución (users por min/sem)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {wk.distribution.map((row) => {
            const widthPct = Math.round((row.users / maxBucketUsers) * 100);
            return (
              <div
                key={row.bucket}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span
                  style={{
                    width: 90,
                    fontSize: 12,
                    color: "var(--mx-muted)",
                    fontFamily: "var(--mx-mono)",
                  }}
                >
                  {row.bucket}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 18,
                    borderRadius: 6,
                    background: "var(--mx-bg-input)",
                    border: "1px solid var(--mx-border)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: "100%",
                      background: "var(--mx-accent)",
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 60,
                    textAlign: "right",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--mx-fg)",
                    fontFamily: "var(--mx-mono)",
                  }}
                >
                  {row.users}
                </span>
              </div>
            );
          })}
          {wk.distribution.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
              Sin datos los últimos 7 días.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Acquisition view: just the checkout funnel KPIs ──
type RetentionCellPayload = {
  retained: number;
  pct: number;
  /** El tramo no ha terminado para todos: solo puede subir. */
  partial: boolean;
};

type RetentionPayload = {
  weeks: number;
  cohorts: Array<{
    weekStart: string;
    users: number;
    weeks: RetentionCellPayload[];
  }>;
  overall: {
    users: number;
    returnEligible: number;
    returned: number;
    returnedPct: number | null;
    milestones: Array<{
      day: number;
      eligible: number;
      retained: number;
      pct: number | null;
    }>;
  };
};

type AcquisitionPayload = {
  source: string;
  windowDays: number;
  /** Falta en respuestas cacheadas de antes de que existiera el panel. */
  retention?: RetentionPayload;
  signups: {
    totalAllTime: number;
    last7d: number;
    last30d: number;
    inWindow: number;
    byPlatform?: { ios: number; android?: number; web: number; unknown: number };
  };
  funnel: {
    signups: number;
    onboarded: number;
    openedStory: number;
    listened: number;
    viewedPlans: number;
    paid: number;
  };
  recent: Array<{
    userId: string;
    name: string | null;
    /** El nombre viene de su solicitud de beta porque Clerk no guardó ninguno. */
    nameFromBeta?: boolean;
    email: string | null;
    createdAt: string;
    targetLanguages: string[];
    /** Declarado en el formulario de beta, para quien aún no onboardeó. */
    betaLanguages?: string[];
    /** Estado en el programa de beta, si esta persona solicitó. */
    betaStatus?: string | null;
    /** Deducido de lo que abrió, cuando no hay nada declarado. */
    inferredLanguages?: string[];
    level: string | null;
    onboarded: boolean;
    openedStory: boolean;
    listened: boolean;
    /** Suma, por historia, del punto más lejano alcanzado en ella. */
    listenedSeconds: number;
    /** El total incluye algún valor que sale de un checkpoint: es un suelo. */
    listenedApprox?: boolean;
    /** Cuántas historias suman en `listenedSeconds`. */
    listenedStories?: number;
    completedStory: boolean;
    viewedPlans: boolean;
    paid: boolean;
    /** Redimió un claim de libro o tiene suscripción viva. */
    bought?: boolean;
    platform: "ios" | "android" | "web" | null;
  }>;
  clerkInstance: string;
};

/** 45 → "45s", 150 → "2m 30s", 120 → "2m". */
function formatListened(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/**
 * Distintivo de beta tester en la fila del usuario.
 *
 * Existe porque el "(beta)" de la columna de idioma NO dice quién es la
 * persona, dice de dónde sacamos el idioma que mostramos, y sólo aparece
 * cuando no hubo onboarding. Un beta tester que sí completó el onboarding
 * salía en la tabla exactamente igual que cualquier otro usuario. Este chip
 * cuelga del email y siempre está, haya onboardeado o no.
 *
 * Se distingue a simple vista quién está DENTRO del programa (invitado o
 * aceptado, mismos estados que `ACTIVE_STATUSES` en `src/lib/betaProgram.ts`)
 * de quien sólo solicitó: mezclarlos era la mitad del problema original.
 */
const BETA_STATUS_LABEL: Record<string, string> = {
  accepted: "aceptado",
  invited: "invitado",
  waitlist: "en espera",
  pending: "sin triar",
  declined: "rechazado",
};
const BETA_STATUS_IN = new Set(["invited", "accepted"]);

function BetaBadge({ status }: { status: string }) {
  const inProgram = BETA_STATUS_IN.has(status);
  const label = BETA_STATUS_LABEL[status] ?? status;
  return (
    <span
      title={
        inProgram
          ? `Beta tester (${label}). Está dentro del programa.`
          : `Solicitó la beta (${label}). Todavía no está dentro del programa.`
      }
      style={{
        marginLeft: 6,
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: inProgram ? "#fcd34d" : "var(--mx-muted, #94a3b8)",
        backgroundColor: inProgram ? "rgba(252, 211, 77, 0.14)" : "rgba(148, 163, 184, 0.12)",
        border: `1px solid ${inProgram ? "rgba(252, 211, 77, 0.3)" : "rgba(148, 163, 184, 0.22)"}`,
      }}
    >
      beta · {label}
    </span>
  );
}

/**
 * Distintivo de comprador. Es el corte que queda DENTRO de "público" una vez
 * que la cohorte saca a los beta testers del bote: quien pagó (un claim de
 * libro de la tienda o una suscripción viva) frente a quien solo se dio de
 * alta. Un beta tester también puede llevarlo; la cohorte dice quién es y
 * esto dice qué hizo.
 */
function BuyerBadge() {
  return (
    <span
      title="Compró: redimió un claim de libro o tiene una suscripción viva."
      style={{
        marginLeft: 6,
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: "#5ad19a",
        backgroundColor: "rgba(90, 209, 154, 0.14)",
        border: "1px solid rgba(90, 209, 154, 0.3)",
      }}
    >
      compró
    </span>
  );
}

function FunnelBar({
  label,
  value,
  base,
  accent,
  note,
}: {
  label: string;
  value: number;
  base: number;
  accent?: string;
  note?: string;
}) {
  const pct = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ opacity: 0.7 }}>
          {value} · {pct}%{note ? ` · ${note}` : ""}
        </span>
      </div>
      <div style={{ height: 10, background: "var(--mx-track, rgba(255,255,255,0.06))", borderRadius: 6 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 6,
            background: accent ?? "var(--mx-accent, #6ea8fe)",
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Tabla de retención por cohorte de alta.
 *
 * Cada fila es una semana de altas y cada columna una semana contada desde el
 * alta de esa gente, no desde el calendario. La primera columna incluye el día
 * del alta, así que mide activación; la retención se lee de la segunda en
 * adelante. Las celdas con punto todavía no han cerrado su tramo para todos
 * los miembros de la cohorte y solo pueden subir.
 */
function RetentionPanel({
  retention,
  days,
}: {
  retention: RetentionPayload;
  days: number;
}) {
  const { cohorts, weeks, overall } = retention;
  const milestoneLabel: Record<number, string> = {
    7: "Seguía a partir del día 7",
    30: "Seguía a partir del día 30",
  };

  const cellStyle = (cell: RetentionCellPayload): React.CSSProperties => {
    // Verde proporcional al porcentaje. El 0% se queda en el fondo del panel
    // para que la vista de conjunto sea "dónde hay color" y no un damero.
    const alpha = cell.pct <= 0 ? 0 : 0.1 + (Math.min(cell.pct, 100) / 100) * 0.55;
    return {
      padding: "5px 6px",
      textAlign: "center",
      background: alpha === 0 ? "transparent" : `rgba(90, 209, 154, ${alpha})`,
      color: cell.pct >= 55 ? "#0b1a13" : "inherit",
      opacity: cell.partial ? 0.55 : 1,
      borderRadius: 4,
      whiteSpace: "nowrap",
    };
  };

  return (
    <div className="mx-panel" style={{ marginBottom: 12 }}>
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Retención</div>
          <h3 className="mx-panel__title">Vuelven, por semana de alta</h3>
        </div>
        <span className="mx-panel__hint">cohortes: altas en {days}d</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <KpiCard
          label="Volvió algún otro día"
          value={
            overall.returnedPct === null ? "s/d" : `${overall.returnedPct}%`
          }
          hint={`${overall.returned} de ${overall.returnEligible}`}
        />
        {overall.milestones.map((m) => (
          <KpiCard
            key={m.day}
            label={milestoneLabel[m.day] ?? `Día ${m.day}`}
            value={m.pct === null ? "s/d" : `${m.pct}%`}
            hint={
              m.eligible === 0
                ? "nadie lleva tanto tiempo"
                : `${m.retained} de ${m.eligible}`
            }
            accent={m.day >= 30 ? "gold" : "xp"}
          />
        ))}
      </div>

      {cohorts.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>
          Sin altas en el rango seleccionado.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, fontSize: 12 }}
          >
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.6 }}>
                <th style={{ padding: "4px 6px" }}>Semana de alta</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Altas</th>
                {Array.from({ length: weeks }, (_, n) => (
                  <th key={n} style={{ padding: "4px 6px", textAlign: "center" }}>
                    {n === 0 ? "Sem 0" : `+${n}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.weekStart}>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{c.weekStart}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", opacity: 0.75 }}>
                    {c.users}
                  </td>
                  {c.weeks.map((cell, n) => (
                    <td
                      key={n}
                      style={cellStyle(cell)}
                      title={`${cell.retained} de ${c.users}${cell.partial ? " (tramo abierto)" : ""}`}
                    >
                      {cell.pct}%
                      {cell.partial ? "\u00b7" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--mx-muted)", lineHeight: 1.5 }}>
        La semana se cuenta desde el alta de cada persona, no desde el lunes:
        la +1 de quien entró un jueves va de su jueves al miércoles siguiente.
        La columna &laquo;Sem 0&raquo; incluye el día del alta, así que mide
        activación; la retención empieza en la +1. Un punto marca el tramo que
        aún no ha cerrado para toda la cohorte, y por eso solo puede subir.
        Cuenta como actividad cualquier evento de esa persona salvo los que
        escribe el servidor (correos de ciclo de vida y envíos de aviso). Los
        hitos son sin techo: &laquo;a partir del día 7&raquo; incluye a quien
        dio señal ese día o cualquiera posterior.
      </p>
    </div>
  );
}

function AcquisitionView({
  data,
  cohort,
}: {
  data: DashboardData;
  cohort: MetricsCohort;
}) {
  const cf = data.checkoutFunnel;
  const days = data.range.days;
  const [acq, setAcq] = useState<AcquisitionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Usuario cuya ficha está abierta. Cada fila de "Altas recientes" abre el
  // panel lateral con todas sus métricas.
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/acquisition?days=${days}&cohort=${cohort}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setAcq(j as AcquisitionPayload);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, cohort]);

  const f = acq?.funnel;
  return (
    <div className="mx-view">
      {/* Signups; sourced from Clerk (no depende del webhook) */}
      <div className="mx-panel" style={{ marginBottom: 12 }}>
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Altas (fuente: Clerk)</div>
            <h3 className="mx-panel__title">Cuentas creadas</h3>
          </div>
          <span className="mx-panel__hint">
            {acq ? `instancia ${acq.clerkInstance}` : ""}
            {error ? ` · error: ${error}` : loading ? " · cargando…" : ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <KpiCard label="Total (histórico)" value={acq?.signups.totalAllTime ?? 0} />
          <KpiCard label="Últimos 30 días" value={acq?.signups.last30d ?? 0} accent="cyan" />
          <KpiCard label="Últimos 7 días" value={acq?.signups.last7d ?? 0} accent="xp" />
          <KpiCard label={`En el rango (${days}d)`} value={acq?.signups.inWindow ?? 0} />
        </div>
      </div>

      {/* Activation funnel */}
      <div className="mx-panel" style={{ marginBottom: 12 }}>
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Activación</div>
            <h3 className="mx-panel__title">Embudo signup → escuchar → pagar</h3>
          </div>
          <span className="mx-panel__hint">cohorte: altas en {days}d</span>
        </div>
        {f && f.signups > 0 ? (
          <>
            <FunnelBar label="Se registraron" value={f.signups} base={f.signups} accent="#6ea8fe" />
            <FunnelBar label="Completaron onboarding (eligieron idioma)" value={f.onboarded} base={f.signups} accent="#5ad19a" />
            <FunnelBar label="Abrieron una historia" value={f.openedStory} base={f.signups} accent="#5ad19a" />
            <FunnelBar
              label="Escucharon audio (progreso real)"
              value={f.listened}
              base={f.signups}
              accent={f.listened === 0 ? "#e0653a" : "#5ad19a"}
              note={f.listened === 0 ? "⚠ nadie escuchó (paywall)" : undefined}
            />
            <FunnelBar label="Vieron precios" value={f.viewedPlans} base={f.signups} accent="#d3a13a" />
            <FunnelBar label="Pagaron" value={f.paid} base={f.signups} accent="#d3a13a" />
          </>
        ) : (
          <p style={{ opacity: 0.6, fontSize: 13 }}>
            {loading ? "Cargando…" : "Sin altas en el rango seleccionado."}
          </p>
        )}
      </div>

      {/* Retención por cohorte de alta */}
      {acq?.retention && <RetentionPanel retention={acq.retention} days={days} />}

      {/* Recent signups */}
      {acq && acq.recent.length > 0 && (
        <div className="mx-panel" style={{ marginBottom: 12 }}>
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Detalle</div>
              <h3 className="mx-panel__title">Altas recientes</h3>
            </div>
            {acq.signups.byPlatform && (
              <div style={{ fontSize: 12, opacity: 0.8, display: "flex", gap: 12 }}>
                <span title="App de iPhone">📱 iOS: {acq.signups.byPlatform.ios}</span>
                {acq.signups.byPlatform.android ? (
                  <span title="App de Android">Android: {acq.signups.byPlatform.android}</span>
                ) : null}
                <span title="Webapp">🌐 Web: {acq.signups.byPlatform.web}</span>
                {acq.signups.byPlatform.unknown > 0 && (
                  <span title="Sin actividad medida aún">- s/d: {acq.signups.byPlatform.unknown}</span>
                )}
              </div>
            )}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--mx-muted)" }}>
            Haz clic en cualquier fila para abrir la ficha completa del usuario.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.6 }}>
                  <th style={{ padding: "4px 6px" }}>Fecha</th>
                  <th style={{ padding: "4px 6px" }}>Usuario</th>
                  <th style={{ padding: "4px 6px" }}>Idioma · nivel</th>
                  <th style={{ padding: "4px 6px" }}>Plataforma</th>
                  <th style={{ padding: "4px 6px" }}>Onb.</th>
                  <th style={{ padding: "4px 6px" }}>Abrió</th>
                  <th style={{ padding: "4px 6px" }}>Escuchó</th>
                  <th style={{ padding: "4px 6px" }}>Precios</th>
                  <th style={{ padding: "4px 6px" }}>Pagó</th>
                </tr>
              </thead>
              <tbody>
                {acq.recent.map((r) => (
                  <tr
                    key={r.userId}
                    className="mx-rowlink"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    onClick={() => setOpenUserId(r.userId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenUserId(r.userId);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    title="Ver todas las métricas de este usuario"
                  >
                    <td style={{ padding: "4px 6px" }}>{r.createdAt.slice(0, 10)}</td>
                    <td style={{ padding: "4px 6px" }}>
                      {r.name ? (
                        r.nameFromBeta ? (
                          // Mismo vocabulario que la columna de idioma: el dato
                          // es suyo, sólo que lo escribió en la solicitud de
                          // beta y no en el alta, porque Clerk no guarda nombre
                          // cuando entras por código de email o con Apple
                          // ocultándolo.
                          <span title="Nombre de su solicitud de beta. Al darse de alta no dejó ninguno en Clerk.">
                            {r.name}
                            <span style={{ opacity: 0.55 }}> (de su solicitud)</span>
                          </span>
                        ) : (
                          r.name
                        )
                      ) : (
                        "-"
                      )}
                      <span style={{ opacity: 0.5 }}> · {r.email ?? "-"}</span>
                      {r.betaStatus ? <BetaBadge status={r.betaStatus} /> : null}
                      {r.bought ? <BuyerBadge /> : null}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {r.targetLanguages.length ? (
                        <>
                          {r.targetLanguages.join("/")}
                          {r.level ? ` · ${r.level}` : ""}
                        </>
                      ) : r.betaLanguages?.length ? (
                        // Declarado por la persona, sólo que en el formulario de
                        // beta y no en el onboarding de la app. Es un dato suyo,
                        // no una suposición nuestra, así que se muestra normal y
                        // sólo se marca de dónde salió. La etiqueta dice "de su
                        // solicitud" y no "(beta)": lo segundo se leía como si
                        // marcara a los beta testers, cuando el distintivo de
                        // beta tester vive en la columna de usuario y esto sólo
                        // habla de la procedencia del idioma.
                        <span title="Declarado en su solicitud de beta. Todavía no ha completado el onboarding de la app.">
                          {r.betaLanguages.join("/")}
                          {r.level ? ` · ${r.level}` : ""}
                          <span style={{ opacity: 0.55 }}> (de su solicitud)</span>
                        </span>
                      ) : r.inferredLanguages?.length ? (
                        // Deducido, no declarado, y se distingue a simple vista:
                        // esta persona nunca contestó qué idioma quería, lo
                        // sabemos porque abrió historias en ese idioma.
                        <span
                          style={{ fontStyle: "italic", opacity: 0.65 }}
                          title="Deducido de las historias que abrió. No completó el onboarding, así que nunca declaró un idioma."
                        >
                          {r.inferredLanguages.join("/")} <span style={{ opacity: 0.7 }}>(por lo que leyó)</span>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      {r.platform === "ios" ? (
                        <span title="App de iPhone">📱 iOS</span>
                      ) : r.platform === "android" ? (
                        <span title="App de Android">Android</span>
                      ) : r.platform === "web" ? (
                        <span title="Webapp">🌐 Web</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ padding: "4px 6px" }}>{r.onboarded ? "✓" : "-"}</td>
                    <td style={{ padding: "4px 6px" }}>{r.openedStory ? "✓" : "-"}</td>
                    <td style={{ padding: "4px 6px" }}>
                      {/* El check ya no tapa el número: terminar una historia
                          es una escucha más, y esconder cuánto llevaba quien
                          había recorrido veinticinco era perder justo al
                          usuario que más nos interesa ver. */}
                      {r.listenedSeconds > 0 ? (
                        <span
                          style={{ cursor: "help" }}
                          title={[
                            `Total: suma del punto más lejano alcanzado en cada historia (${r.listenedStories ?? 1}).`,
                            r.completedStory ? "Terminó al menos una." : null,
                            r.listenedApprox
                              ? "* El progreso se graba a saltos de ~20s, así que el total es un suelo, no una medición exacta."
                              : null,
                            "Es posición dentro del audio, no tiempo de reloj: quien arrastra la barra cuenta hasta donde la soltó.",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {r.completedStory && <span style={{ color: "#5ad19a" }}>✓ </span>}
                          {formatListened(r.listenedSeconds)}
                          {r.listenedApprox && <span style={{ opacity: 0.5 }}>*</span>}
                        </span>
                      ) : r.completedStory ? (
                        <span style={{ color: "#5ad19a" }}>✓</span>
                      ) : r.listened ? (
                        <span
                          title="Tocó play pero no se pudo medir cuánto escuchó (cerró sin pausar y antes de 10s). No es 0s real."
                          style={{ cursor: "help", opacity: 0.7 }}
                        >
                          ▶?
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ padding: "4px 6px" }}>{r.viewedPlans ? "✓" : "-"}</td>
                    <td style={{ padding: "4px 6px" }}>{r.paid ? "✓" : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--mx-muted)", lineHeight: 1.5 }}>
            <strong style={{ fontWeight: 600 }}>Escuchó</strong>: suma del punto más lejano alcanzado
            en cada historia, no tiempo de reloj. <span style={{ color: "#5ad19a" }}>✓</span> = terminó
            al menos una. <span>*</span> = el valor incluye algún checkpoint, que se graba a saltos de
            ~20s, así que es un suelo. <span>▶?</span> = dio play pero se fue antes del primer
            checkpoint, así que no hay nada medido.
          </p>
        </div>
      )}

      {/* Checkout funnel (existente) */}
      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Checkout</div>
            <h3 className="mx-panel__title">Embudo de pago</h3>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <KpiCard label="Plans viewed" value={cf.plansViewed} />
          <KpiCard label="Checkout started" value={cf.checkoutStarted} accent="cyan" hint={`${cf.checkoutStartRate}% del plans view`} />
          <KpiCard label="Checkout redirected" value={cf.checkoutRedirected} accent="xp" hint={`${cf.checkoutRedirectRate}% del checkout start`} />
          <KpiCard label="Checkout failed" value={cf.checkoutFailed} accent="accent" />
        </div>
      </div>

      {openUserId && (
        <UserDetailDrawer userId={openUserId} onClose={() => setOpenUserId(null)} />
      )}
    </div>
  );
}

// ── Content view: pipeline metrics ──
function ContentView({ data }: { data: PipelineData }) {
  return (
    <div className="mx-view">
      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Pipeline</div>
            <h3 className="mx-panel__title">Agent runs</h3>
          </div>
          <span className="mx-panel__hint">
            {data.agentRuns.total} runs · {data.agentRuns.byStatus.failed} failed
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Total runs" value={data.agentRuns.total} />
          <KpiCard
            label="Completed"
            value={data.agentRuns.byStatus.completed}
            accent="xp"
          />
          <KpiCard
            label="Failed"
            value={data.agentRuns.byStatus.failed}
            accent="accent"
          />
          <KpiCard label="Running" value={data.agentRuns.byStatus.running} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginTop: 10,
          }}
        >
          <KpiCard label="Planner" value={data.agentRuns.byKind.planner} />
          <KpiCard label="Content" value={data.agentRuns.byKind.content} />
          <KpiCard label="QA" value={data.agentRuns.byKind.qa} />
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Drafts</div>
            <h3 className="mx-panel__title">Story drafts</h3>
          </div>
          <span className="mx-panel__hint">
            QA pass {data.drafts.qaPassRate}% · published{" "}
            {data.drafts.byStatus.published}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Total drafts" value={data.drafts.total} />
          <KpiCard
            label="QA pass rate"
            value={data.drafts.qaPassRate}
            suffix="%"
            accent="xp"
          />
          <KpiCard
            label="Avg QA score"
            value={
              data.drafts.avgQaScore !== null
                ? data.drafts.avgQaScore.toFixed(2)
                : "-"
            }
            accent="gold"
          />
          <KpiCard
            label="Published"
            value={data.drafts.byStatus.published}
            accent="xp"
          />
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Pipeline performance</div>
            <h3 className="mx-panel__title">Throughput</h3>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard
            label="Avg time to publish"
            value={
              data.pipeline.avgTimeToPublish !== null
                ? Math.round(data.pipeline.avgTimeToPublish)
                : "-"
            }
            suffix="min"
            accent="gold"
          />
          <KpiCard
            label="Content per day"
            value={fmt(data.pipeline.contentPerDay)}
            accent="cyan"
          />
        </div>
      </div>
    </div>
  );
}
