"use client";

import { useEffect, useRef, useState } from "react";
import StudioShell from "@/components/studio/StudioShell";
import {
  ComingSoonView,
  AudiobooksView,
  EngagementView,
  VanityView,
  FunnelsView,
  LearningView,
  ResumenView,
} from "@/components/studio/metrics/MetricsViews";
import {
  KpiCard,
} from "@/components/studio/metrics/MetricsPrimitives";
import UserDetailDrawer from "@/components/studio/metrics/UserDetailDrawer";
import { PerUserTable } from "@/components/studio/metrics/PerUserTable";
import type {
  DashboardData,
  MetricsSection,
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
    usersWithReminder: 0,
    tapsPerUserWithReminder: 0,
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
  catalog: null,
};


/**
 * Las once secciones, al mismo nivel y en una sola fila.
 *
 * Antes iban en dos grupos: cuatro normales a la izquierda y siete apagadas a
 * la derecha, que era una jerarquía heredada de cuando esas siete estaban a
 * medias. Ya no lo están, y el grupo apagado ocupaba justo el sitio donde
 * ahora van los selectores globales.
 */
const TABS: Array<{ key: MetricsSection; label: string }> = [
  { key: "overview", label: "Summary" },
  { key: "acquisition", label: "Acquisition" },
  { key: "engagement", label: "Engagement" },
  { key: "funnels", label: "Funnels" },
  { key: "audience", label: "Audience" },
  { key: "content", label: "Content" },
  { key: "learning", label: "Learning" },
  { key: "alerts", label: "Alerts" },
  // La última a propósito: son los totales acumulados, y van detrás de todo
  // lo que sí admite un mal dato.
  { key: "vanity", label: "Vanity metrics" },
  // Al final del todo: es el otro producto, y el resto del tablero lo excluye.
  { key: "audiobooks", label: "Audiobooks" },
];

/** Superficie. Vive aquí y no dentro de un panel: filtra TODO el tablero. */
const PLATFORM_OPTIONS = [
  { key: "all" as const, label: "Todos" },
  { key: "web" as const, label: "Web" },
  { key: "ios" as const, label: "iOS" },
  { key: "android" as const, label: "Android" },
];

/** Grano de todas las series temporales, incluidas las cohortes de retención. */
const GRAIN_OPTIONS = [
  { key: "day" as const, label: "Día" },
  { key: "week" as const, label: "Semana" },
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
  const [cohort, setCohort] = useState<MetricsCohort>("all");
  const [section, setSection] = useState<MetricsSection>("overview");
  const [platform, setPlatform] = useState<"all" | "web" | "ios" | "android">("all");
  const [grain, setGrain] = useState<"day" | "week">("day");
  /**
   * La pestaña que se está mirando AHORA, legible desde dentro de una petición
   * en vuelo. Cambiar de pestaña dispara una petición sin cancelar la
   * anterior, y la del Resumen tarda más que las demás: al llegar la última
   * pisaba los datos de la pestaña abierta y la dejaba con todo a cero. El
   * estado `section` no sirve para esto porque la función asíncrona se queda
   * con el valor que tenía cuando arrancó.
   */
  const sectionRef = useRef<MetricsSection>("overview");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadMetrics(
    targetSection: MetricsSection = section,
    force = false
  ) {
    // Contenido NO se sale por aquí. Su panel de pipeline se pide aparte (lo
    // lanza el efecto de la sección), pero su primera tarjeta, "Catálogo
    // tocado en el rango", sale del tablero como cualquier otra. Con el
    // return de antes esa petición no se hacía nunca y la tarjeta leía el
    // EMPTY_DATA inicial: enseñaba 0 historias y 0 libros mientras la base
    // tenía 196 historias y 8 libros tocados en 30 días.
    if (!force && sectionCache[targetSection]) {
      setData(sectionCache[targetSection] ?? EMPTY_DATA);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      const qs = new URLSearchParams();
      qs.set("section", targetSection);
      qs.set("platform", platform);
      qs.set("grain", grain);
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
      qs.set("cohort", cohort);
      const res = await fetch(`/api/metrics/dashboard?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as DashboardData;
      // La respuesta se guarda siempre: aunque llegue tarde, la pestaña que la
      // pidió la encontrará en la caché sin volver a pedirla.
      setSectionCache((c) => ({ ...c, [targetSection]: json }));
      if (sectionRef.current !== targetSection) return;
      setData(json);
    } catch (err) {
      // Un fallo de una pestaña que ya no se está mirando no pinta un error
      // encima de los datos buenos de la que sí.
      if (sectionRef.current !== targetSection) return;
      const msg = err instanceof Error ? err.message : String(err);
      const message = msg.includes("403")
        ? "No tienes acceso a métricas."
        : `No se pudieron cargar las métricas: ${msg}`;
      setErrorMessage(message);
      console.error("Error loading metrics dashboard:", err);
      setData(EMPTY_DATA);
    } finally {
      if (sectionRef.current === targetSection) setLoading(false);
    }
  }

  useEffect(() => {
    sectionRef.current = section;
    if (sectionCache[section]) {
      setData(sectionCache[section] ?? EMPTY_DATA);
      return;
    }
    // Un `setTimeout(0)` para no pedir dentro del render del cambio de
    // pestaña, y nada más: envolverlo además en `requestAnimationFrame`
    // ataba la petición a que el navegador fuera a pintar, así que en una
    // pestaña en segundo plano no salía nunca y la sección se quedaba a cero
    // hasta volver a ella.
    const timeoutId = window.setTimeout(() => {
      void loadMetrics(section);
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
  }, [days, customFrom, customTo, cohort, platform, grain]);

  function renderActiveSection() {
    if (section === "overview") return <ResumenView data={data} cohort={cohort} rangeLabel={periodLabel} platform={platform} />;
    if (section === "vanity") return <VanityView data={data} />;
    if (section === "audiobooks") return <AudiobooksView data={data} />;
    if (section === "engagement") return <EngagementView data={data} />;
    if (section === "funnels")
      return (
        <FunnelsView
          data={data}
          activation={<ActivationFunnelPanel days={data.range.days} cohort={cohort} />}
        />
      );

    if (section === "audience") {
      return <AudienceView data={data} />;
    }
    if (section === "content") {
      return <ContentView dashboard={data} />;
    }
    if (section === "acquisition") {
      return <AcquisitionView data={data} cohort={cohort} />;
    }
    if (section === "learning") {
      return <LearningView learning={data.learning} />;
    }
    return (
      <ComingSoonView
        title="Alertas"
        description="Umbrales para caídas de completion rate, anomalías de tráfico y fallos de pipeline o API."
      />
    );
  }

  const periodLabel = formatRangeLabel(data.range.from, data.range.to);
  // Los extremos del rango vigente en el formato que pide <input type="date">.
  // Cuanto hace que se calcularon estos numeros. `generatedAt` viaja dentro
  // del payload, asi que un acierto de cache trae su hora original.
  const frescura = (() => {
    const t = data.generatedAt ? Date.parse(data.generatedAt) : NaN;
    if (!Number.isFinite(t)) return { texto: "-", titulo: "sin sello de calculo" };
    const seg = Math.max(0, Math.round((Date.now() - t) / 1000));
    const titulo = `Calculado a las ${new Date(t).toLocaleTimeString("es-ES")}`;
    if (seg < 10) return { texto: "ahora", titulo };
    if (seg < 60) return { texto: `hace ${seg} s`, titulo };
    const min = Math.round(seg / 60);
    if (min < 60) return { texto: `hace ${min} min`, titulo };
    return { texto: `hace ${Math.round(min / 60)} h`, titulo };
  })();
  const rangoDesde = data.range.from ? data.range.from.slice(0, 10) : "";
  const rangoHasta = data.range.to ? data.range.to.slice(0, 10) : "";

  const filtersForm = (
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
        {/*
          Los dos campos vienen con el rango que se está viendo, aunque venga
          de un preset. Antes salían vacíos y el rango se leía en una línea
          aparte, así que para acotar por fechas había que rellenar los dos.
          Tocando UNO basta: el otro se siembra con el extremo vigente, que es
          el que ya estaba en pantalla.
        */}
        <input
          type="date"
          value={customFrom || rangoDesde}
          max={customTo || rangoHasta || undefined}
          onChange={(e) => {
            setCustomFrom(e.target.value);
            if (!customTo) setCustomTo(rangoHasta);
          }}
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
          value={customTo || rangoHasta}
          min={customFrom || rangoDesde || undefined}
          onChange={(e) => {
            setCustomTo(e.target.value);
            if (!customFrom) setCustomFrom(rangoDesde);
          }}
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

      <span className="mx-filters__spacer" />

      <div className="mx-filters__actions">
        {/*
          El sello de frescura vive aqui, donde estaba "Exportar", y no en una
          franja propia debajo: ocupaba una linea entera para tres palabras.
          Y dice la HORA de calculo en vez de un "ahora" escrito a mano: antes
          era un literal, asi que decia lo mismo con datos de hace un segundo
          que de hace una hora. Ahora sale de `generatedAt`, que el servidor
          sella al calcular y viaja dentro del payload.
        */}
        <span className="mx-live" title={frescura.titulo}>
          <span className="mx-live__dot" />
          <span className="mx-mono">{frescura.texto}</span>
        </span>
        <button
          type="submit"
          className="mx-btn mx-btn--primary"
          disabled={loading}
        >
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>
    </form>
  );

  return (
    <StudioShell
      title="Métricas"
      headerAside={filtersForm}
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
        </div>

        {cohort !== "all" && COHORT_BLIND_SECTIONS.includes(section) ? (
          // Esta sección no sale de eventos de usuario (el pipeline editorial
          // no tiene a quién atribuirle nada), así que el filtro se dice en
          // voz alta en vez de fingir que se aplicó.
          <div
            className="mx-panel"
            style={{ padding: "8px 12px", fontSize: 12, color: "var(--mx-muted)" }}
          >
            El filtro de cohorte solo afecta a las dos tarjetas de consumo:
            el resto sale del pipeline editorial, no de lo que hace la gente
            en la app.
          </div>
        ) : null}

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
            {TABS.map((tab) => {
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
            <div className="mx-segmented">
              {PLATFORM_OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => setPlatform(o.key)}
                  className={
                    platform === o.key
                      ? "mx-segmented__btn mx-segmented__btn--active"
                      : "mx-segmented__btn"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mx-segmented">
              {GRAIN_OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => setGrain(o.key)}
                  className={
                    grain === o.key
                      ? "mx-segmented__btn mx-segmented__btn--active"
                      : "mx-segmented__btn"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
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

      <PerUserTable rows={data.audience.perUser ?? []} days={data.range.days} />
    </div>
  );
}

// ── Acquisition view: just the checkout funnel KPIs ──
type RetentionCellPayload = {
  retained: number;
  pct: number;
  /** El tramo no ha terminado para todos: solo puede subir. */
  partial: boolean;
  /** Quiénes cuentan en ese porcentaje. Falta en respuestas cacheadas viejas. */
  retainedIds?: string[];
};

type RetentionPayload = {
  /** 7 en la vista semanal, 1 en la diaria. */
  bucketDays: number;
  buckets: number;
  cohorts: Array<{
    start: string;
    users: number;
    cells: RetentionCellPayload[];
    /** Toda la cohorte, para nombrar también a quien no volvió. */
    userIds?: string[];
  }>;
  omittedCohorts: number;
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

type RetentionUserPayload = {
  name: string | null;
  email: string | null;
  /** Suma del punto más lejano alcanzado en cada historia, en toda la ventana. */
  listenedSeconds: number;
  listenedApprox: boolean;
  listenedStories: number;
  completedStory: boolean;
};

type AcquisitionPayload = {
  source: string;
  windowDays: number;
  /** Falta en respuestas cacheadas de antes de que existiera el panel. */
  retention?: RetentionPayload;
  /** La misma retención agrupada por día de alta. */
  retentionDaily?: RetentionPayload;
  /** Quién es cada id de la retención y cuánto lleva alcanzado. */
  retentionUsers?: Record<string, RetentionUserPayload>;
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
    /** Práctica. Falta en respuestas cacheadas de antes de la columna. */
    practiceStarted?: number;
    practiceCompleted?: number;
    /** Media de aciertos de las sesiones terminadas. */
    practiceAccuracy?: number | null;
    platform: "ios" | "android" | "web" | null;
    /** De dónde vino. Falta en respuestas cacheadas de antes de la columna. */
    origin?: { key: string; label: string; basis: "stamped" | "probable" | "unknown" };
    /** Por qué puerta entró. Falta en respuestas cacheadas de antes. */
    userType?: { key: "beta" | "audiolibro" | "app" | "web" | "unknown"; label: string };
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
 * Por qué puerta entró esta persona al producto. Una sola por fila y siempre
 * hay una: es la pregunta que la tabla no sabía contestar cuando quien no era
 * beta tester ni comprador salía sin ninguna etiqueta.
 *
 * No dice si paga (columna Pagó) ni si ha hecho algo (Onb., Abrió). Mezclar
 * esos tres ejes en un mismo distintivo fue justo lo que dejó filas mudas.
 */
function UserTypeBadge({
  type,
}: {
  type: { key: "beta" | "audiolibro" | "app" | "web" | "unknown"; label: string };
}) {
  const tone: Record<string, string> = {
    beta: "var(--studio-accent)",
    audiolibro: "#5ad19a",
    app: "#6ea8fe",
    web: "#94a3b8",
  };
  const unknown = type.key === "unknown";
  const color = unknown ? "var(--mx-muted, #94a3b8)" : tone[type.key] ?? "#94a3b8";
  const title: Record<string, string> = {
    beta: "Entró por el programa de beta (invitado o aceptado).",
    audiolibro: "Entró comprando un audiolibro: redimió el claim de la tienda.",
    app: "Se dio de alta desde la app del móvil.",
    web: "Se dio de alta navegando en la webapp.",
    unknown: "Cuenta sin plataforma sellada y sin actividad. No se adivina.",
  };
  return (
    <span
      title={title[type.key]}
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color,
        backgroundColor: unknown ? "transparent" : `color-mix(in srgb, ${color} 13%, transparent)`,
        border: `1px solid ${unknown ? "transparent" : `color-mix(in srgb, ${color} 30%, transparent)`}`,
        opacity: unknown ? 0.55 : 1,
      }}
    >
      {type.label}
    </span>
  );
}

/**
 * De dónde vino esta cuenta. Toda fila lleva una: antes, quien no era beta
 * tester ni comprador salía sin nada y no había manera de saber si llegó por
 * un anuncio, por la tienda o buscando en Google.
 *
 * La cursiva y el "?" no son decoración: separan lo que selló su propia
 * visita de lo que se dedujo cruzando la hora del alta con la única sesión
 * que pasó por la página de alta en esos minutos.
 */
function OriginBadge({
  origin,
}: {
  origin: { key: string; label: string; basis: "stamped" | "probable" | "unknown" };
}) {
  const unknown = origin.basis === "unknown";
  const probable = origin.basis === "probable";
  const tone: Record<string, string> = {
    ad: "#e0653a",
    email: "#6ea8fe",
    shop: "#5ad19a",
    search: "#d3a13a",
    social: "#c084fc",
  };
  const color = unknown ? "var(--mx-muted, #94a3b8)" : tone[origin.key] ?? "#94a3b8";
  return (
    <span
      title={
        unknown
          ? "Cuenta anterior al sello de origen. No se adivina de dónde vino."
          : probable
            ? "Deducido: cruce por hora con la visita a la página de alta, o por la tienda de la app. No lo selló su propia visita."
            : "Sellado en su primera visita (primer toque: utm o referrer)."
      }
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10.5,
        whiteSpace: "nowrap",
        fontStyle: probable ? "italic" : "normal",
        opacity: unknown ? 0.55 : 1,
        color,
        backgroundColor: unknown ? "transparent" : "rgba(148, 163, 184, 0.12)",
        border: `1px solid ${unknown ? "transparent" : "rgba(148, 163, 184, 0.22)"}`,
      }}
    >
      {origin.label}
      {probable ? " ?" : ""}
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
 * Contenido de la tarjeta que sale al pasar el cursor por una celda de la
 * tabla de retención. Se guarda ya resuelta a nombres para que el render de
 * la tarjeta no vuelva a tocar el diccionario de usuarios.
 */
type HoverCard = {
  x: number;
  y: number;
  title: string;
  headline: string;
  /** Lo alcanzado por la gente de la celda, ya sumado. */
  listened: string | null;
  note?: string;
  returned: HoverPerson[];
  missing: HoverPerson[];
};

/** Una persona dentro de la tarjeta: cómo se llama y cuánto lleva alcanzado. */
type HoverPerson = {
  id: string;
  label: string;
  listened: string | null;
  approx: boolean;
  completed: boolean;
};

/** Cuántos nombres caben en la tarjeta antes de que estorbe más que ayuda. */
const HOVER_NAME_LIMIT = 5;

/**
 * Una persona de la tarjeta. Quien entró con código por correo o con Apple
 * escondiendo el nombre no deja ninguno en Clerk, así que el correo es el
 * segundo mejor identificador y el id, el último recurso. El tiempo es el de
 * la ventana entera, no el del tramo: la instrumentación guarda hasta dónde
 * llegó cada quien en cada historia, no cuánto avanzó cada día.
 */
function retentionPerson(
  userId: string,
  users?: Record<string, RetentionUserPayload>,
): HoverPerson {
  const u = users?.[userId];
  // Nunca un trozo de id: ver `kpiUserLabel`.
  const label = u?.name || u?.email || "Sin identificar";
  const seconds = u?.listenedSeconds ?? 0;
  return {
    id: userId,
    label,
    listened: seconds > 0 ? formatListened(seconds) : null,
    approx: Boolean(u?.listenedApprox),
    completed: Boolean(u?.completedStory),
  };
}

function HoverNameList({ label, people }: { label: string; people: HoverPerson[] }) {
  if (people.length === 0) return null;
  // Delante van los que más han alcanzado: en una lista recortada, quien
  // escucha es la información y quien no aparece llega igual en el recuento.
  const sorted = [...people].sort(
    (a, b) => (b.listened ? 1 : 0) - (a.listened ? 1 : 0) || a.label.localeCompare(b.label),
  );
  const shown = sorted.slice(0, HOVER_NAME_LIMIT);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.55 }}>
        {label} ({people.length})
      </div>
      <ul style={{ margin: "3px 0 0", padding: 0, listStyle: "none" }}>
        {shown.map((p) => (
          <li
            key={p.id}
            style={{ display: "flex", gap: 8, fontSize: 11.5, lineHeight: 1.5, alignItems: "baseline" }}
          >
            <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.completed ? <span style={{ color: "#5ad19a" }}>✓ </span> : null}
              {p.label}
            </span>
            <span style={{ opacity: p.listened ? 0.8 : 0.4, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {p.listened ? `${p.listened}${p.approx ? "*" : ""}` : "sin audio"}
            </span>
          </li>
        ))}
        {people.length > shown.length ? (
          <li style={{ fontSize: 11.5, opacity: 0.6 }}>y {people.length - shown.length} más</li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Lo alcanzado por un grupo de la tarjeta: la suma, y cuánta de esa gente no
 * tiene ni un segundo medido. Sin la segunda mitad, un total alto esconde que
 * lo puso una sola persona.
 */
function summariseListened(
  people: HoverPerson[],
  users?: Record<string, RetentionUserPayload>,
): string | null {
  if (people.length === 0) return null;
  let seconds = 0;
  let withAudio = 0;
  let approx = false;
  for (const p of people) {
    const u = users?.[p.id];
    const s = u?.listenedSeconds ?? 0;
    if (s > 0) withAudio += 1;
    seconds += s;
    if (u?.listenedApprox) approx = true;
  }
  if (seconds <= 0) return "nadie con audio medido";
  return `${formatListened(seconds)}${approx ? "*" : ""} entre ${withAudio} de ${people.length}`;
}

/**
 * Tabla de retención por cohorte de alta.
 *
 * Cada fila es un tramo de altas (una semana, o un día si se pide grano fino)
 * y cada columna el mismo tramo contado desde el alta de esa gente, no desde
 * el calendario. La primera columna incluye el día del alta, así que mide
 * activación; la retención se lee de la segunda en adelante. Las celdas con
 * punto todavía no han cerrado su tramo para todos los miembros de la cohorte
 * y solo pueden subir.
 *
 * Las dos granularidades llegan calculadas en la misma respuesta, así que
 * alternar entre ellas no vuelve a pedir nada al servidor.
 */
function RetentionPanel({
  retention,
  retentionDaily,
  users,
  days,
}: {
  retention: RetentionPayload;
  retentionDaily?: RetentionPayload;
  users?: Record<string, RetentionUserPayload>;
  days: number;
}) {
  const [grain, setGrain] = useState<"weekly" | "daily">("weekly");
  /**
   * Celda sobre la que está el cursor. La tabla es un damero de porcentajes
   * sobre cohortes de dos o tres personas, así que la pregunta que sigue a
   * cualquier celda es siempre la misma: quién. La tarjeta la responde con
   * nombres en vez de obligar a cruzarla con la lista de altas.
   */
  const [hover, setHover] = useState<HoverCard | null>(null);
  const active = grain === "daily" && retentionDaily ? retentionDaily : retention;
  const { cohorts, buckets, overall, omittedCohorts } = active;
  const isDaily = active.bucketDays === 1;
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

  /**
   * Media ponderada por columna: la curva de retención de toda la gente junta,
   * que es lo que se lee de un vistazo cuando cada cohorte trae dos o tres
   * personas y sus porcentajes saltan entre 0 y 100.
   *
   * Solo entran las celdas CERRADAS. Una parcial mete en el promedio a quien
   * todavía no ha llegado a ese día, así que la columna se hundiría a base de
   * ceros que no son abandono sino falta de tiempo.
   */
  const averages = Array.from({ length: buckets }, (_, n) => {
    let retained = 0;
    let base = 0;
    let closed = 0;
    for (const c of cohorts) {
      const cell = c.cells[n];
      if (!cell || cell.partial) continue;
      retained += cell.retained;
      base += c.users;
      closed += 1;
    }
    return {
      retained,
      base,
      closed,
      pct: base > 0 ? Math.round((retained / base) * 1000) / 10 : null,
    };
  });

  const personOf = (id: string) => retentionPerson(id, users);
  const columnLabel = (n: number) => (n === 0 ? (isDaily ? "Día 0" : "Sem 0") : `+${n}`);

  /**
   * Fecha de calendario de la columna. Solo se puede dar en diario: en semanal
   * la cohorte reúne siete días de altas y cada persona corre su propio reloj,
   * así que la columna no cae en un día común a todos.
   */
  const columnDate = (start: string, n: number): string | null => {
    if (!isDaily) return null;
    const base = Date.parse(`${start}T00:00:00Z`);
    if (Number.isNaN(base)) return null;
    return new Date(base + n * 86400000).toISOString().slice(0, 10);
  };

  const positionOf = (e: React.MouseEvent) => ({ x: e.clientX, y: e.clientY });

  const cohortCard = (
    e: React.MouseEvent,
    c: RetentionPayload["cohorts"][number],
    cell: RetentionCellPayload,
    n: number,
  ): HoverCard => {
    const on = columnDate(c.start, n);
    const retainedIds = cell.retainedIds;
    const missingIds = retainedIds
      ? (c.userIds ?? []).filter((id) => !retainedIds.includes(id))
      : [];
    const returned = (retainedIds ?? []).map(personOf);
    return {
      ...positionOf(e),
      title: `Alta ${c.start} · ${columnLabel(n)}${on ? ` (${on})` : ""}`,
      headline: `${cell.retained} de ${c.users} · ${cell.pct}%`,
      listened: summariseListened(returned, users),
      note: !retainedIds
        ? "Esta respuesta viene de antes de que las celdas trajeran nombres; recarga la página."
        : cell.partial
          ? "Tramo abierto: aún no ha terminado para toda la cohorte, así que solo puede subir."
          : undefined,
      returned,
      missing: missingIds.map(personOf),
    };
  };

  /**
   * La fila del promedio junta a la gente de todas las cohortes que ya
   * cerraron ese tramo, que es exactamente la base con la que se calcula.
   */
  const averageCard = (e: React.MouseEvent, n: number): HoverCard => {
    const closed = cohorts.filter((c) => c.cells[n] && !c.cells[n].partial);
    const returned: HoverPerson[] = [];
    const missing: HoverPerson[] = [];
    for (const c of closed) {
      const ids = c.cells[n].retainedIds;
      if (!ids) continue;
      for (const id of c.userIds ?? []) {
        (ids.includes(id) ? returned : missing).push(personOf(id));
      }
    }
    const avg = averages[n];
    return {
      ...positionOf(e),
      title: `Promedio · ${columnLabel(n)}`,
      listened: summariseListened(returned, users),
      headline:
        avg.pct === null
          ? "Ninguna cohorte ha cerrado este tramo todavía"
          : `${avg.retained} de ${avg.base} · ${avg.pct}% · ${avg.closed} ${
              avg.closed === 1 ? "cohorte cerrada" : "cohortes cerradas"
            }`,
      note: "Media ponderada por personas, no por cohortes; los tramos abiertos quedan fuera.",
      returned,
      missing,
    };
  };

  return (
    <div className="mx-panel" style={{ marginBottom: 12 }}>
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Retención</div>
          <h3 className="mx-panel__title">
            Vuelven, por {isDaily ? "día" : "semana"} de alta
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="mx-segmented">
            {([
              { key: "weekly" as const, label: "Semanal" },
              { key: "daily" as const, label: "Diario" },
            ]).map((option) => (
              <button
                type="button"
                key={option.key}
                disabled={option.key === "daily" && !retentionDaily}
                title={
                  option.key === "daily" && !retentionDaily
                    ? "Esta respuesta viene de antes de que existiera la vista diaria"
                    : undefined
                }
                onClick={() => setGrain(option.key)}
                className={
                  grain === option.key
                    ? "mx-segmented__btn mx-segmented__btn--active"
                    : "mx-segmented__btn"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="mx-panel__hint">cohortes: altas en {days}d</span>
        </div>
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
                <th style={{ padding: "4px 6px" }}>
                  {isDaily ? "Día de alta" : "Semana de alta"}
                </th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Altas</th>
                {Array.from({ length: buckets }, (_, n) => (
                  <th key={n} style={{ padding: "4px 6px", textAlign: "center" }}>
                    {n === 0 ? (isDaily ? "Día 0" : "Sem 0") : `+${n}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.start}>
                  <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{c.start}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", opacity: 0.75 }}>
                    {c.users}
                  </td>
                  {c.cells.map((cell, n) => (
                    <td
                      key={n}
                      style={{ ...cellStyle(cell), cursor: "default" }}
                      onMouseEnter={(e) => setHover(cohortCard(e, c, cell, n))}
                      onMouseMove={(e) => setHover(cohortCard(e, c, cell, n))}
                      onMouseLeave={() => setHover(null)}
                    >
                      {cell.pct}%
                      {cell.partial ? "\u00b7" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td
                  style={{
                    padding: "7px 6px 5px",
                    whiteSpace: "nowrap",
                    borderTop: "1px solid var(--mx-border, rgba(255,255,255,0.14))",
                  }}
                >
                  Promedio
                </td>
                <td
                  style={{
                    padding: "7px 6px 5px",
                    textAlign: "right",
                    opacity: 0.75,
                    borderTop: "1px solid var(--mx-border, rgba(255,255,255,0.14))",
                  }}
                >
                  {cohorts.reduce((sum, c) => sum + c.users, 0)}
                </td>
                {averages.map((avg, n) => (
                  <td
                    key={n}
                    style={{
                      ...cellStyle({
                        retained: avg.retained,
                        pct: avg.pct ?? 0,
                        partial: false,
                      }),
                      padding: "7px 6px 5px",
                      borderTop: "1px solid var(--mx-border, rgba(255,255,255,0.14))",
                      opacity: avg.pct === null ? 0.4 : 1,
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => setHover(averageCard(e, n))}
                    onMouseMove={(e) => setHover(averageCard(e, n))}
                    onMouseLeave={() => setHover(null)}
                  >
                    {avg.pct === null ? "s/d" : `${avg.pct}%`}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--mx-muted)", lineHeight: 1.5 }}>
        {isDaily ? (
          <>
            Cada fila es un día de altas y cada columna un día contado desde
            esa alta. La columna &laquo;Día 0&raquo; es el día del alta, así
            que mide activación; la retención empieza en la +1.
          </>
        ) : (
          <>
            La semana se cuenta desde el alta de cada persona, no desde el
            lunes: la +1 de quien entró un jueves va de su jueves al miércoles
            siguiente. La columna &laquo;Sem 0&raquo; incluye el día del alta,
            así que mide activación; la retención empieza en la +1.
          </>
        )}{" "}
        Un punto marca el tramo que
        aún no ha cerrado para toda la cohorte, y por eso solo puede subir.
        Cuenta como actividad cualquier evento de esa persona salvo los que
        escribe el servidor (correos de ciclo de vida y envíos de aviso). Los
        hitos son sin techo: &laquo;a partir del día 7&raquo; incluye a quien
        dio señal ese día o cualquiera posterior. Las tarjetas de arriba no
        dependen del grano: salen de la misma gente en los dos casos. La fila
        &laquo;Promedio&raquo; es la media ponderada de la columna contando
        personas, no cohortes, y deja fuera los tramos aún abiertos: por eso su
        base se estrecha hacia la derecha y pone &laquo;s/d&raquo; donde nadie
        ha cumplido todavía ese día.
        {omittedCohorts > 0
          ? ` Quedan ${omittedCohorts} tramos más antiguos fuera de la tabla.`
          : ""}{" "}
        Al pasar el cursor por un porcentaje sale quién lo compone.
      </p>

      {hover ? (
        <div
          style={{
            position: "fixed",
            // Se pega al cursor, pero sin salirse por el borde derecho ni por
            // abajo: la tabla llega hasta el final del panel y la tarjeta de
            // una cohorte grande mide bastante.
            left: Math.min(hover.x + 16, Math.max(8, window.innerWidth - 320)),
            top: Math.min(hover.y + 16, Math.max(8, window.innerHeight - 410)),
            zIndex: 60,
            width: 320,
            // Alto de la peor tarjeta posible: cabecera, tiempo, nota, las dos
            // listas llenas hasta el tope y el pie. Así nada queda cortado.
            maxHeight: 400,
            overflow: "hidden",
            pointerEvents: "none",
            padding: "9px 11px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.45,
            color: "var(--mx-fg)",
            background: "var(--mx-bg-3)",
            border: "1px solid var(--mx-border, rgba(255,255,255,0.16))",
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
          }}
        >
          <div style={{ opacity: 0.6, fontSize: 11 }}>{hover.title}</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{hover.headline}</div>
          {hover.listened ? (
            <div style={{ marginTop: 3, fontSize: 11.5, opacity: 0.85 }}>
              Alcanzado: {hover.listened}
            </div>
          ) : null}
          {hover.note ? (
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>{hover.note}</div>
          ) : null}
          <HoverNameList label="Dieron señal" people={hover.returned} />
          <HoverNameList label="No dieron señal" people={hover.missing} />
          <div style={{ marginTop: 7, fontSize: 10.5, opacity: 0.5, lineHeight: 1.4 }}>
            El tiempo es de la ventana entera, no de este tramo: es la suma del punto
            más lejano alcanzado en cada historia, y el asterisco marca que el
            progreso se graba a saltos de ~20s.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * El embudo de activacion, que ahora se pinta en la pestana de Embudos.
 *
 * Se trae sus datos solo porque salen de `/api/metrics/acquisition` y no del
 * tablero; el resto de embudos ya viajan dentro de `DashboardData`.
 */
function ActivationFunnelPanel({
  days,
  cohort,
}: {
  days: number;
  cohort: MetricsCohort;
}) {
  const [funnel, setFunnel] = useState<AcquisitionPayload["funnel"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/metrics/acquisition?days=${days}&cohort=${cohort}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: AcquisitionPayload) => {
        if (!cancelled) setFunnel(j.funnel ?? null);
      })
      .catch(() => {
        if (!cancelled) setFunnel(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, cohort]);

  const f = funnel;
  return (
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
  );
}

function AcquisitionView({
  data,
  cohort,
}: {
  data: DashboardData;
  cohort: MetricsCohort;
}) {
  const days = data.range.days;
  const [acq, setAcq] = useState<AcquisitionPayload | null>(null);
  // Usuario cuya ficha está abierta. Cada fila de "Altas recientes" abre el
  // panel lateral con todas sus métricas.
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  // Ni carga ni error tienen ya donde pintarse: los dos sitios que los
  // enseñaban (el panel de altas de Clerk y el embudo de activación) han
  // salido de esta vista. Los dos paneles que quedan se dibujan solo cuando
  // hay datos, asi que un fallo deja la vista vacia en vez de a medias.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metrics/acquisition?days=${days}&cohort=${cohort}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!cancelled) setAcq(j as AcquisitionPayload);
      })
      .catch(() => {
        if (!cancelled) setAcq(null);
      });
    return () => {
      cancelled = true;
    };
  }, [days, cohort]);

  return (
    <div className="mx-view">
      {/* Retención por cohorte de alta */}
      {acq?.retention && (
        <RetentionPanel
          retention={acq.retention}
          retentionDaily={acq.retentionDaily}
          users={acq.retentionUsers}
          days={days}
        />
      )}

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
                  <th style={{ padding: "4px 6px" }}>Tipo</th>
                  <th style={{ padding: "4px 6px" }}>Origen</th>
                  <th style={{ padding: "4px 6px" }}>Plataforma</th>
                  <th style={{ padding: "4px 6px" }}>Onb.</th>
                  <th style={{ padding: "4px 6px" }}>Abrió</th>
                  <th style={{ padding: "4px 6px" }}>Escuchó</th>
                  <th style={{ padding: "4px 6px" }}>Practicó</th>
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
                      <UserTypeBadge
                        type={r.userType ?? { key: "unknown", label: "s/d" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <OriginBadge
                        origin={r.origin ?? { key: "unknown", label: "s/d", basis: "unknown" }}
                      />
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
                    <td style={{ padding: "4px 6px" }}>
                      {/* Terminadas/empezadas y la nota media. Las dos cifras
                          juntas porque por separado engañan: cinco sesiones
                          empezadas parece uso y puede ser abandono, y un 95%
                          sobre una sola sesión no es una nota, es una tirada. */}
                      {(r.practiceStarted ?? 0) > 0 ? (
                        <span
                          style={{ cursor: "help", fontVariantNumeric: "tabular-nums" }}
                          title={[
                            `${r.practiceCompleted ?? 0} sesiones terminadas de ${r.practiceStarted} empezadas.`,
                            typeof r.practiceAccuracy === "number"
                              ? `Media de aciertos de las terminadas: ${r.practiceAccuracy}%.`
                              : "Ninguna terminada, así que no hay nota.",
                          ].join(" ")}
                        >
                          {r.practiceCompleted ?? 0}/{r.practiceStarted}
                          {typeof r.practiceAccuracy === "number" && (
                            <span style={{ opacity: 0.7 }}> · {r.practiceAccuracy}%</span>
                          )}
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
            <br />
            <strong style={{ fontWeight: 600 }}>Practicó</strong>: sesiones terminadas de las
            empezadas, y la media de aciertos de las terminadas. Una sesión abandonada no deja
            nota, así que no cuenta en la media.
          </p>
        </div>
      )}

      {openUserId && (
        <UserDetailDrawer userId={openUserId} onClose={() => setOpenUserId(null)} />
      )}
    </div>
  );
}

// ── Content view: pipeline metrics ──
/**
 * Contenido: la salud del catalogo PUBLICADO.
 *
 * Hasta el 2026-09-24 esta pestaña medía nuestro propio taller: runs de
 * agentes, borradores, throughput, QA pass rate. Eso dice como vamos
 * nosotros y no cambia ninguna decision sobre el producto. Lo que si la
 * cambia es que journey no abre nadie, que historia se queda sin terminar y
 * si algo salio publicado con huecos.
 *
 * El panel del pipeline no se borra: vive en Studio, en su sitio, y esta
 * pestaña es de metricas de producto.
 */
function ContentView({ dashboard }: { dashboard: DashboardData }) {
  const c = dashboard.catalog;
  if (!c) {
    return (
      <div className="mx-view">
        <p style={{ opacity: 0.6, fontSize: 13 }}>Cargando catálogo…</p>
      </div>
    );
  }

  const pctTocado = c.stories > 0 ? Math.round((c.touchedStories / c.stories) * 100) : 0;
  const maxLectores = Math.max(1, ...c.rows.map((r) => r.readers));

  return (
    <div className="mx-view">
      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Catálogo publicado</div>
            <h3 className="mx-panel__title">Qué está vivo</h3>
          </div>
          <span className="mx-panel__hint">{dashboard.range.days}d</span>
        </div>
        <div className="mx-hero-grid">
          <KpiCard label="Journeys publicados" value={c.journeys} />
          <KpiCard
            label="Historias tocadas"
            value={c.touchedStories}
            hint={`${pctTocado}% de ${c.stories}`}
            accent="cyan"
          />
          <KpiCard
            label="Journeys sin una apertura"
            value={c.deadJourneys}
            hint="nadie los abrió en el rango"
            accent={c.deadJourneys > 0 ? "accent" : undefined}
          />
          <KpiCard
            label="Huecos publicados"
            value={c.emptySlots + c.storiesWithoutAudio + c.storiesWithoutPractice}
            hint={`${c.emptySlots} sin texto · ${c.storiesWithoutAudio} sin audio · ${c.storiesWithoutPractice} sin práctica`}
            accent={
              c.emptySlots + c.storiesWithoutAudio + c.storiesWithoutPractice > 0
                ? "accent"
                : undefined
            }
          />
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Journey a journey</div>
            <h3 className="mx-panel__title">De lo que nadie abre a lo que se lee</h3>
          </div>
          <span className="mx-panel__hint">ordenado por historias tocadas</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.6 }}>
                <th style={{ padding: "4px 6px" }}>Journey</th>
                <th style={{ padding: "4px 6px" }}>Nivel</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Tocadas</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Terminadas</th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Lectores</th>
                <th style={{ padding: "4px 6px", width: "28%" }}></th>
                <th style={{ padding: "4px 6px", textAlign: "right" }}>Huecos</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => {
                const huecos =
                  r.slots - r.written + r.withoutAudio + r.withoutPractice;
                return (
                  <tr
                    key={r.id}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "4px 6px" }}>{r.label}</td>
                    <td style={{ padding: "4px 6px", opacity: 0.75 }}>
                      {r.levels.join(", ").toUpperCase()}
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: r.touched === 0 ? "var(--mx-neg)" : undefined,
                      }}
                    >
                      {r.touched}/{r.written}
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.finished}
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.readers}
                    </td>
                    <td style={{ padding: "4px 6px" }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.07)",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((r.readers / maxLectores) * 100)}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: "var(--mx-cyan)",
                          }}
                        />
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: huecos > 0 ? "var(--mx-neg)" : "var(--mx-muted)",
                      }}
                    >
                      {huecos || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--mx-muted)" }}>
          <strong style={{ fontWeight: 600 }}>Tocadas</strong>: historias con al menos una
          apertura o un play en el rango, sobre las que tienen texto escrito.{" "}
          <strong style={{ fontWeight: 600 }}>Huecos</strong>: slots sin texto, más historias
          sin audio, más historias sin set de práctica. Un journey publicado no debería tener
          ninguno.
        </p>
      </div>
    </div>
  );
}
