"use client";

import { useMemo } from "react";
import {
  BarRow,
  EmptyPanel,
  FunnelChart,
  KpiCard,
  LangTag,
  fmt,
} from "./MetricsPrimitives";
import { RatingsPanel } from "./RatingsPanel";
import { RetentionPanel } from "./RetentionPanel";
import { sparkDates, sparkSeries } from "./dailyHelpers";
import type { DashboardData } from "./types";
import type { MetricsCohort } from "@/lib/metricsCohort";

/**
 * The three primary views (Resumen, Engagement, Funnels) of the
 * redesigned studio metrics dashboard. Each view reads the same
 * `data` payload and renders a dense, editorial layout built on the
 * `.mx-*` design tokens defined in globals.css. Other tabs keep
 * their existing renderers in page.tsx.
 */

// ── ResumenView ──────────────────────────────────────────
export function ResumenView({
  data,
  cohort,
  rangeLabel,
  platform,
  grain,
}: {
  data: DashboardData;
  cohort: MetricsCohort;
  rangeLabel: string;
  platform: "all" | "web" | "ios" | "android";
  grain: "day" | "week";
}) {
  const k = data.kpis;
  const p = data.prevKpis;
  const dias = useMemo(() => sparkDates(data.daily), [data.daily]);
  const sparkDau = useMemo(
    () => sparkSeries(data.daily, "activeUsers"),
    [data.daily]
  );
  const sparkWau = useMemo(() => sparkSeries(data.daily, "wau"), [data.daily]);
  const sparkDauMau = useMemo(
    () => sparkSeries(data.daily, "dauMauPct"),
    [data.daily]
  );
  const sparkMinOyente = useMemo(
    () => sparkSeries(data.daily, "minutesPerListener"),
    [data.daily]
  );
  const sparkEjercicios = useMemo(
    () => sparkSeries(data.daily, "exercisesPerPractitioner"),
    [data.daily]
  );
  const sparkCr = useMemo(
    () => sparkSeries(data.daily, "completionRate"),
    [data.daily]
  );


  return (
    <div className="mx-view">
      <div className="mx-hero-grid">
        <KpiCard
          hero
          label="DAU"
          value={k.dau}
          prev={p?.dau}
          spark={sparkDau}
          sparkLabel="usuarios activos por día"
          sparkDates={dias}
          accent="accent"
          hint="usuarios activos hoy"
          people={data.kpiUsers?.dau}
          peopleWindow="hoy"
        />
        <KpiCard
          hero
          label="WAU"
          value={k.wau}
          prev={p?.wau}
          spark={sparkWau}
          sparkLabel="activos en los 7 días que acaban ahí"
          sparkDates={dias}
          accent="cyan"
          hint="7 días, hoy incluido"
          people={data.kpiUsers?.wau}
          peopleWindow="7 días, hoy incluido"
        />
        <KpiCard
          hero
          label="DAU/MAU"
          value={k.dauMauPct ?? 0}
          suffix="%"
          spark={sparkDauMau}
          sparkLabel="DAU sobre MAU, día a día"
          sparkSuffix="%"
          sparkDates={dias}
          accent="gems"
          hint={
            k.mau
              ? `medio 30d / ${k.mau} MAU · Duolingo 37%`
              : "DAU medio 30d / MAU"
          }
        />
        <KpiCard
          hero
          label="Completion rate"
          value={k.completionRate}
          suffix="%"
          prev={p?.completionRate}
          spark={sparkCr}
          sparkLabel="completion rate por día"
          sparkSuffix="%"
          sparkDates={dias}
          accent="xp"
          hint={
            k.storiesStarted
              ? `${k.storiesFinished ?? 0} de ${k.storiesStarted} historias empezadas`
              : "terminadas / empezadas"
          }
        />
        <KpiCard
          hero
          label="Min por oyente"
          value={k.minutesPerListener ?? 0}
          prev={p?.minutesPerListener}
          spark={sparkMinOyente}
          sparkDates={dias}
          sparkLabel="minutos por oyente y día"
          sparkSuffix="min"
          accent="gold"
          hint={
            k.listeners
              ? `${k.listeners} reprodujeron algo · ${data.range.days}d`
              : `minutos de audio · ${data.range.days}d`
          }
        />
        <KpiCard
          hero
          label="Ejercicios por practicante"
          value={k.exercisesPerPractitioner ?? 0}
          prev={p?.exercisesPerPractitioner}
          spark={sparkEjercicios}
          sparkDates={dias}
          sparkLabel="ejercicios por practicante y día"
          accent="gems"
          hint={
            k.practitioners
              ? `${k.practitioners} practicaron · ${data.range.days}d`
              : `sesiones terminadas · ${data.range.days}d`
          }
        />
      </div>

      <div className="mx-retention-row">
        <RetentionPanel
          days={data.range.days}
          cohort={cohort}
          rangeLabel={rangeLabel}
          platform={platform}
          mode={grain}
        />
        <LanguageSplitPanel rows={data.languageSplit ?? []} days={data.range.days} />
      </div>
    </div>
  );
}

// ── AudiobooksView ────────────────────────────────────────
/**
 * Los audiolibros, aparte del resto del tablero.
 *
 * Todo lo demás del Studio EXCLUYE esta actividad y esta pestaña solo la
 * incluye: el corte es por evento, no por persona, así que quien lee un
 * journey y además un libro cuenta en los dos sitios por lo que hizo en cada
 * uno. Quien solo tiene libros no aparece en ninguna otra pestaña, porque no
 * tiene un solo evento fuera de un libro.
 */
export function AudiobooksView({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const filas = data.audiobookSplit ?? [];
  const dias = useMemo(() => sparkDates(data.daily), [data.daily]);
  const sparkMinutos = useMemo(
    () => sparkSeries(data.daily, "listenedMinutes"),
    [data.daily]
  );
  const sparkCr = useMemo(
    () => sparkSeries(data.daily, "completionRate"),
    [data.daily]
  );

  return (
    <div className="mx-view">
      <div className="mx-hero-grid">
        <KpiCard
          hero
          label="Lectores"
          value={k.activeUsersInRange}
          prev={p2(data)?.activeUsersInRange}
          accent="cyan"
          hint={`personas con alguna señal · ${data.range.days}d`}
        />
        <KpiCard
          hero
          label="Min por oyente"
          value={k.minutesPerListener ?? 0}
          spark={sparkMinutos}
          sparkDates={dias}
          sparkLabel="minutos de audiolibro por día"
          sparkSuffix="min"
          accent="gold"
          hint={k.listeners ? `${k.listeners} reprodujeron algo` : "minutos de audio"}
        />
        <KpiCard
          hero
          label="Completion rate"
          value={k.completionRate}
          suffix="%"
          spark={sparkCr}
          sparkDates={dias}
          sparkLabel="completion rate por día"
          sparkSuffix="%"
          accent="xp"
          hint={`${k.storiesFinished ?? 0} de ${k.storiesStarted ?? 0} empezadas`}
        />
        <KpiCard
          hero
          label="Total escuchado"
          value={k.totalListenedMinutes}
          suffix="min"
          spark={sparkMinutos}
          sparkDates={dias}
          sparkLabel="minutos de audiolibro por día"
          sparkSuffix="min"
          accent="accent"
          hint="suma de minutos"
        />
      </div>

      <div className="mx-panel" style={{ minWidth: 0 }}>
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Catálogo</div>
            <h3 className="mx-panel__title">Libro a libro</h3>
          </div>
          <span className="mx-panel__hint">{data.range.days}d</span>
        </div>
        {filas.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
            Sin datos en el rango seleccionado.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mx-table">
              <thead>
                <tr>
                  <th>Libro</th>
                  <th style={{ textAlign: "right" }}>Pers.</th>
                  <th style={{ textAlign: "right" }}>Min</th>
                  <th style={{ textAlign: "right" }}>Min/p.</th>
                  <th style={{ textAlign: "right" }}>Empez.</th>
                  <th style={{ textAlign: "right" }}>Term.</th>
                  <th style={{ textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.book}>
                    <td>{f.book}</td>
                    <td style={{ textAlign: "right" }}>{f.users}</td>
                    <td style={{ textAlign: "right" }}>{f.minutes}</td>
                    <td style={{ textAlign: "right" }}>
                      {f.users > 0 ? Math.round((f.minutes / f.users) * 10) / 10 : 0}
                    </td>
                    <td style={{ textAlign: "right" }}>{f.started}</td>
                    <td style={{ textAlign: "right" }}>{f.finished}</td>
                    <td style={{ textAlign: "right" }}>{f.completionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** El periodo anterior, cuando la respuesta lo trae. */
function p2(data: DashboardData) {
  return data.prevKpis;
}

// ── LanguageSplitPanel ──────────────────────────────────────────
/**
 * Dónde está la gente dentro del catálogo, por idioma y variante.
 *
 * Es una TABLA y no una lista de barras: la barra compara tamaños de un
 * vistazo y no puede llevar encima los minutos por persona ni las empezadas
 * contra las terminadas, que es donde se ve que los libros mueven a 23
 * personas y solo rematan el 20%.
 *
 * Es la decisión más cara del proyecto: cada journey nuevo son veintiuna
 * historias con sus portadas y su narración, y hasta ahora ninguna pantalla
 * decía en qué idioma hay lectores. El corte llega a la VARIANTE porque
 * español no es una cosa: latam y España son journeys distintos, con otro
 * reparto y otro vocabulario, y agruparlos borraría justo lo que se decide.
 *
 * El idioma sale de la historia (`JourneyStory` -> `Journey`), no del evento:
 * `metadata.language` solo lo emite el móvil y dejaba fuera a los usuarios de
 * la web.
 */
function LanguageSplitPanel({
  rows,
  days,
}: {
  rows: NonNullable<DashboardData["languageSplit"]>;
  days: number;
}) {
  return (
    <div className="mx-panel" style={{ minWidth: 0 }}>
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Catálogo</div>
          <h3 className="mx-panel__title">Dónde está la gente</h3>
        </div>
        <span className="mx-panel__hint">{days}d · por idioma y variante</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
          Sin datos en el rango seleccionado.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="mx-table">
            <thead>
              <tr>
                <th>Idioma y variante</th>
                <th style={{ textAlign: "right" }} title="Personas">Pers.</th>
                <th style={{ textAlign: "right" }} title="Minutos escuchados">Min</th>
                <th style={{ textAlign: "right" }} title="Minutos por persona">Min/p.</th>
                <th style={{ textAlign: "right" }} title="Historias empezadas">Empez.</th>
                <th style={{ textAlign: "right" }} title="Historias terminadas">Term.</th>
                <th style={{ textAlign: "right" }} title="Porcentaje terminadas">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((fila) => (
                <tr key={`${fila.language}/${fila.variant}`}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <LangTag code={LANG_CODE[fila.language] ?? null} />
                      {etiquetaIdioma(fila)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{fila.users}</td>
                  <td style={{ textAlign: "right" }}>{fila.minutes}</td>
                  <td style={{ textAlign: "right" }}>
                    {fila.users > 0
                      ? Math.round((fila.minutes / fila.users) * 10) / 10
                      : 0}
                  </td>
                  <td style={{ textAlign: "right" }}>{fila.started}</td>
                  <td style={{ textAlign: "right" }}>{fila.finished}</td>
                  <td style={{ textAlign: "right" }}>{fila.completionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** "spanish · latam", o solo "libros" cuando no hay variante que decir. */
function etiquetaIdioma(fila: { language: string; variant: string }): string {
  return fila.variant ? `${fila.language} · ${fila.variant}` : fila.language;
}

/** El idioma viene entero de la base ("spanish"); la etiqueta quiere el código. */
const LANG_CODE: Record<string, string> = {
  spanish: "es",
  italian: "it",
  german: "de",
  french: "fr",
  portuguese: "pt",
  english: "en",
};

// ── VanityView ───────────────────────────────────────────
/**
 * Los totales acumulados, apartados del Resumen.
 *
 * Suben siempre: un total no puede bajar mientras siga entrando gente, así
 * que dicen que la app existe y no dicen si funciona. Viven juntos aquí para
 * que el Resumen se quede con lo que sí admite un mal dato (DAU, WAU,
 * DAU/MAU, completion rate) y no compitan por el sitio con las razones.
 */
export function VanityView({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const p = data.prevKpis;
  const dias = useMemo(() => sparkDates(data.daily), [data.daily]);
  const sparkDau = useMemo(
    () => sparkSeries(data.daily, "activeUsers"),
    [data.daily]
  );
  const sparkMinutos = useMemo(
    () => sparkSeries(data.daily, "listenedMinutes"),
    [data.daily]
  );
  const sparkPlays = useMemo(
    () => sparkSeries(data.daily, "plays"),
    [data.daily]
  );
  const sparkCompletions = useMemo(
    () => sparkSeries(data.daily, "completions"),
    [data.daily]
  );

  return (
    <div className="mx-view">
      <div className="mx-hero-grid">
        <KpiCard
          hero
          label="Total escuchado"
          value={k.totalListenedMinutes}
          suffix="min"
          prev={p?.totalListenedMinutes}
          spark={sparkMinutos}
          sparkLabel="minutos de audio por día"
          sparkSuffix="min"
          sparkDates={dias}
          accent="gold"
          hint="suma de minutos"
        />
        <KpiCard
          hero
          label="Plays (solo web)"
          value={k.plays}
          prev={p?.plays}
          spark={sparkPlays}
          sparkLabel="reproducciones web por día"
          sparkDates={dias}
          accent="accent"
          hint={`el móvil no emite play · ${data.range.days}d`}
        />
        <KpiCard
          hero
          label="Active users"
          value={k.activeUsersInRange}
          prev={p?.activeUsersInRange}
          spark={sparkDau}
          sparkLabel="usuarios activos por día"
          sparkDates={dias}
          accent="cyan"
          hint={`con alguna señal · ${data.range.days}d`}
        />
        <KpiCard
          hero
          label="Completions"
          value={k.completions}
          prev={p?.completions}
          spark={sparkCompletions}
          sparkLabel="historias terminadas por día"
          sparkDates={dias}
          accent="xp"
          hint="historias terminadas"
        />
      </div>
    </div>
  );
}

// ── EngagementView ───────────────────────────────────────
export function EngagementView({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const p = data.prevKpis;
  const dias = useMemo(() => sparkDates(data.daily), [data.daily]);
  const sparkMinutos = useMemo(
    () => sparkSeries(data.daily, "listenedMinutes"),
    [data.daily]
  );
  const sparkMinOyente = useMemo(
    () => sparkSeries(data.daily, "minutesPerListener"),
    [data.daily]
  );
  const sparkEjercicios = useMemo(
    () => sparkSeries(data.daily, "exercisesPerPractitioner"),
    [data.daily]
  );
  const sparkPlays = useMemo(
    () => sparkSeries(data.daily, "plays"),
    [data.daily]
  );
  const sparkCompletions = useMemo(
    () => sparkSeries(data.daily, "completions"),
    [data.daily]
  );
  const sparkCr = useMemo(
    () => sparkSeries(data.daily, "completionRate"),
    [data.daily]
  );

  const maxStoryMinutes = data.topStoriesByMinutes[0]?.listenedMinutes ?? 0;
  const maxBookPlays = data.topBooks[0]?.plays ?? 0;


  return (
    <div className="mx-view">
      <div className="mx-subkpi-grid">
        <KpiCard
          label="Plays (solo web)"
          value={k.plays}
          prev={p?.plays}
          spark={sparkPlays}
          sparkLabel="reproducciones web por día"
          sparkDates={dias}
          accent="accent"
        />
        <KpiCard
          label="Completions"
          value={k.completions}
          prev={p?.completions}
          spark={sparkCompletions}
          sparkLabel="historias terminadas por día"
          sparkDates={dias}
          accent="xp"
        />
        <KpiCard
          label="Completion rate"
          value={k.completionRate}
          suffix="%"
          prev={p?.completionRate}
          spark={sparkCr}
          sparkLabel="completion rate por día"
          sparkSuffix="%"
          sparkDates={dias}
          accent="xp"
        />
        <KpiCard
          label="Min por oyente"
          value={k.minutesPerListener ?? 0}
          prev={p?.minutesPerListener}
          spark={sparkMinOyente}
          sparkDates={dias}
          sparkLabel="minutos por oyente y día"
          sparkSuffix="min"
          accent="gold"
        />
        <KpiCard
          label="Ejercicios por practicante"
          value={k.exercisesPerPractitioner ?? 0}
          prev={p?.exercisesPerPractitioner}
          spark={sparkEjercicios}
          sparkDates={dias}
          sparkLabel="ejercicios por practicante y día"
          accent="gems"
        />
        <KpiCard
          label="Total escuchado"
          value={k.totalListenedMinutes}
          suffix="min"
          prev={p?.totalListenedMinutes}
          spark={sparkMinutos}
          sparkLabel="minutos de audio por día"
          sparkSuffix="min"
          sparkDates={dias}
          accent="gold"
        />
        <KpiCard
          label="Stories saved"
          value={k.savedStories}
          prev={p?.savedStories}
          accent="gems"
        />
        <KpiCard
          label="Books saved"
          value={k.savedBooks}
          prev={p?.savedBooks}
          accent="gems"
        />
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Stories</div>
            <h3 className="mx-panel__title">Top historias por minutos</h3>
          </div>
          <div className="mx-tabs-mini">
            <button
              className="mx-tabs-mini__btn mx-tabs-mini__btn--active"
              type="button"
            >
              Minutos
            </button>
            <button
              className="mx-tabs-mini__btn"
              type="button"
              title="Próximamente"
              disabled
            >
              Plays
            </button>
            <button
              className="mx-tabs-mini__btn"
              type="button"
              title="Próximamente"
              disabled
            >
              Completion rate
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="mx-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Historia</th>
                <th style={{ width: 56 }}>Idioma</th>
                <th style={{ width: 280 }}>Minutos escuchados</th>
                <th style={{ width: 90, textAlign: "right" }}>Listeners</th>
              </tr>
            </thead>
            <tbody>
              {data.topStoriesByMinutes.map((story, i) => {
                const lang = story.language;
                const widthPct =
                  maxStoryMinutes === 0
                    ? 0
                    : (story.listenedMinutes / maxStoryMinutes) * 100;
                return (
                  <tr key={story.storySlug}>
                    <td className="mx-table__rank">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="mx-table__slug">{story.storySlug}</td>
                    <td>{lang ? <LangTag code={lang} /> : null}</td>
                    <td>
                      <div className="mx-table__bar">
                        <div
                          className="mx-table__bar-fill"
                          style={{ width: `${widthPct}%` }}
                        />
                        <span className="mx-table__bar-value">
                          {fmt(story.listenedMinutes)} min
                        </span>
                      </div>
                    </td>
                    <td className="mx-table__num">{story.listeners}</td>
                  </tr>
                );
              })}
              {data.topStoriesByMinutes.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: 24,
                      color: "var(--mx-muted)",
                      textAlign: "center",
                    }}
                  >
                    Sin datos en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RatingsPanel ratings={data.ratings} />

      <div className="mx-row mx-row--2up">
        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Books</div>
              <h3 className="mx-panel__title">Top libros por plays</h3>
            </div>
            <span className="mx-panel__hint">CR coloreado por umbral</span>
          </div>
          <div className="mx-barlist">
            {data.topBooks.map((book) => {
              // Books no traen language en este payload todavía. Sin tag
              // hasta que el server lo exponga (evita falsos positivos
              // como "DP-COLOMBIAN" -> "es" por el sufijo "-co-").
              const lang: string | null = null;
              const accent =
                book.completionRate >= 60
                  ? "var(--mx-pos)"
                  : "var(--mx-accent)";
              return (
                <BarRow
                  key={book.bookSlug}
                  label={book.bookSlug}
                  value={book.plays}
                  max={maxBookPlays || 1}
                  suffix="plays"
                  tag={lang ? <LangTag code={lang} /> : null}
                  sub={`${book.completions} completions · CR ${book.completionRate}%`}
                  accent={accent}
                />
              );
            })}
            {data.topBooks.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin libros con plays en el rango.
              </p>
            )}
          </div>
        </div>

        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">CR</div>
              <h3 className="mx-panel__title">
                Distribución de completion rate
              </h3>
            </div>
          </div>
          <CrHistogram data={data} />
        </div>
      </div>
    </div>
  );
}

function CrHistogram({ data }: { data: DashboardData }) {
  const buckets = useMemo(() => {
    const rows = [
      { label: "0-25%", min: 0, max: 25, count: 0 },
      { label: "25-50%", min: 25, max: 50, count: 0 },
      { label: "50-75%", min: 50, max: 75, count: 0 },
      { label: "75-100%", min: 75, max: 101, count: 0 },
    ];
    for (const story of data.topStories) {
      const row = rows.find(
        (r) => story.completionRate >= r.min && story.completionRate < r.max
      );
      if (row) row.count += 1;
    }
    return rows;
  }, [data.topStories]);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const colorMap = [
    "var(--mx-neg)",
    "var(--mx-warn)",
    "var(--mx-accent)",
    "var(--mx-pos)",
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 6,
        height: 120,
        marginTop: 8,
      }}
    >
      {buckets.map((bucket, i) => {
        const h = (bucket.count / maxCount) * 100;
        return (
          <div
            key={bucket.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "flex-end",
                minHeight: 60,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(h, 6)}%`,
                  background: colorMap[i],
                  borderRadius: "4px 4px 0 0",
                  minHeight: 18,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  paddingTop: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--mx-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#001a17",
                  }}
                >
                  {bucket.count}
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: 10.5,
                fontFamily: "var(--mx-mono)",
                color: "var(--mx-muted)",
                textAlign: "center",
              }}
            >
              {bucket.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── FunnelsView ──────────────────────────────────────────
export function FunnelsView({ data }: { data: DashboardData }) {
  const trialSteps = [
    { label: "Trial iniciado", value: data.trialFunnel.started },
    { label: "Con método de pago", value: data.trialFunnel.startedWithPm },
    { label: "Activación día 1", value: data.trialFunnel.day1Active },
    { label: "Convertidos", value: data.trialFunnel.converted },
  ];

  const checkoutSteps = [
    { label: "Plans viewed", value: data.checkoutFunnel.plansViewed },
    { label: "Checkout started", value: data.checkoutFunnel.checkoutStarted },
    {
      label: "Checkout redirected",
      value: data.checkoutFunnel.checkoutRedirected,
    },
    { label: "Checkout failed", value: data.checkoutFunnel.checkoutFailed },
  ];

  const journeySteps = [
    { label: "Variant seleccionada", value: data.journeyFunnel.variantSelected },
    { label: "Nivel seleccionado", value: data.journeyFunnel.levelSelected },
    { label: "Topic abierto", value: data.journeyFunnel.topicOpened },
    { label: "Next action click", value: data.journeyFunnel.nextActionClicked },
    { label: "Review CTA click", value: data.journeyFunnel.reviewCtaClicked },
  ];

  const reminderSteps = [
    { label: "Scheduled", value: data.reminderFunnel.scheduled },
    { label: "Tapped", value: data.reminderFunnel.tapped },
    {
      label: "Destination opened",
      value: data.reminderFunnel.destinationOpened,
    },
  ];

  const maxReminderDestination =
    data.reminderFunnel.destinationBreakdown[0]?.opens ?? 0;
  const maxUpgradeCta = data.upgradeCtaSources[0]?.clicks ?? 0;

  return (
    <div className="mx-view">
      <div className="mx-row mx-row--2up">
        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Acquisition · Trial</div>
              <h3 className="mx-panel__title">Trial → Conversión</h3>
            </div>
            <span className="mx-panel__hint">
              {data.trialFunnel.conversionRate}% conversión
            </span>
          </div>
          <FunnelChart steps={trialSteps} accent="var(--mx-accent)" />
          <div className="mx-rate-grid">
            <div className="mx-rate">
              <span>Day-1 activation</span>
              <strong>{data.trialFunnel.day1ActivationRate}%</strong>
            </div>
            <div className="mx-rate">
              <span>Conversión final</span>
              <strong style={{ color: "var(--mx-pos)" }}>
                {data.trialFunnel.conversionRate}%
              </strong>
            </div>
            <div className="mx-rate">
              <span>Cancel rate</span>
              <strong style={{ color: "var(--mx-neg)" }}>
                {data.trialFunnel.cancelRate}%
              </strong>
            </div>
          </div>
        </div>

        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Acquisition · Checkout</div>
              <h3 className="mx-panel__title">Plans → Stripe</h3>
            </div>
            <span className="mx-panel__hint">
              {data.checkoutFunnel.checkoutStartRate}% start rate
            </span>
          </div>
          <FunnelChart steps={checkoutSteps} accent="var(--mx-cyan)" />
          <div className="mx-rate-grid">
            <div className="mx-rate">
              <span>Plans → Checkout</span>
              <strong>{data.checkoutFunnel.checkoutStartRate}%</strong>
            </div>
            <div className="mx-rate">
              <span>Checkout → Redirect</span>
              <strong style={{ color: "var(--mx-pos)" }}>
                {data.checkoutFunnel.checkoutRedirectRate}%
              </strong>
            </div>
            <div className="mx-rate">
              <span>Failed</span>
              <strong style={{ color: "var(--mx-neg)" }}>
                {data.checkoutFunnel.checkoutFailed}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Journey</div>
            <h3 className="mx-panel__title">Journey funnel</h3>
          </div>
          <span className="mx-panel__hint">
            desde variant select hasta review CTA
          </span>
        </div>
        <FunnelChart steps={journeySteps} accent="var(--mx-xp)" />
        <div className="mx-rate-grid mx-rate-grid--4">
          <div className="mx-rate">
            <span>Variant → Topic open</span>
            <strong>{data.journeyFunnel.topicOpenRateFromVariant}%</strong>
          </div>
          <div className="mx-rate">
            <span>Topic open → Next action</span>
            <strong>{data.journeyFunnel.nextActionRateFromTopicOpen}%</strong>
          </div>
          <div className="mx-rate">
            <span>Topic open → Review</span>
            <strong>{data.journeyFunnel.reviewRateFromTopicOpen}%</strong>
          </div>
          <div className="mx-rate">
            <span>Checkpoint recovery</span>
            <strong>{data.journeyFunnel.checkpointRecoveryClicked}</strong>
          </div>
        </div>
      </div>

      <div className="mx-row mx-row--2up">
        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Retention</div>
              <h3 className="mx-panel__title">Reminders → Destination</h3>
            </div>
            <span className="mx-panel__hint">
              {data.reminderFunnel.tapRateFromScheduled}% tap rate
            </span>
          </div>
          <FunnelChart steps={reminderSteps} accent="var(--mx-gold)" />
          <div className="mx-panel__sub">Destination breakdown</div>
          <div className="mx-barlist mx-barlist--compact">
            {data.reminderFunnel.destinationBreakdown.map((row) => (
              <BarRow
                key={row.destination}
                label={row.destination}
                value={row.opens}
                max={maxReminderDestination || 1}
                suffix="opens"
                accent="var(--mx-gold)"
              />
            ))}
            {data.reminderFunnel.destinationBreakdown.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin opens en el rango.
              </p>
            )}
          </div>
        </div>

        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Upgrade CTAs</div>
              <h3 className="mx-panel__title">Clicks por origen</h3>
            </div>
            <span className="mx-panel__hint">¿qué CTA convierte?</span>
          </div>
          <div className="mx-barlist">
            {data.upgradeCtaSources.map((row) => (
              <BarRow
                key={row.source}
                label={row.source}
                value={row.clicks}
                max={maxUpgradeCta || 1}
                suffix="clicks"
                accent="var(--mx-gems)"
              />
            ))}
            {data.upgradeCtaSources.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin clicks en el rango.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Reminders · Recent</div>
            <h3 className="mx-panel__title">Últimos taps de notificaciones</h3>
          </div>
          <span className="mx-panel__hint">señal cruda</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="mx-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Cuándo</th>
                <th>Email</th>
                <th>User ID</th>
                <th>Destino</th>
                <th>Origen</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReminderTaps.map((row) => (
                <tr
                  key={`${row.userId}-${row.createdAt}-${row.destination ?? "?"}`}
                >
                  <td className="mx-table__when">
                    {new Date(row.createdAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{row.email ?? "-"}</td>
                  <td className="mx-mono">{row.userId}</td>
                  <td>{row.destination ?? "-"}</td>
                  <td style={{ color: "var(--mx-muted)" }}>
                    {row.source ?? "-"}
                  </td>
                </tr>
              ))}
              {data.recentReminderTaps.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: 24,
                      color: "var(--mx-muted)",
                      textAlign: "center",
                    }}
                  >
                    Sin taps recientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Placeholder for tabs that don't have a dedicated view yet ──
export function ComingSoonView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-view">
      <EmptyPanel title={title} description={description} />
    </div>
  );
}

// ── LearningView ─────────────────────────────────────────
const PRACTICE_MODE_LABELS: Record<string, string> = {
  context: "Contexto",
  meaning: "Significado",
  match: "Emparejar",
  listening: "Escucha",
  mixed: "Mixto",
};

/**
 * El tipo de palabra llega en inglés desde el móvil (`wordType`) y el
 * resto del panel está en español, así que se traduce al pintarlo. Lo
 * que no esté en el mapa cae tal cual: es preferible una etiqueta en
 * inglés a un hueco.
 */
const WORD_TYPE_LABELS: Record<string, string> = {
  noun: "sustantivo",
  verb: "verbo",
  adjective: "adjetivo",
  adverb: "adverbio",
  pronoun: "pronombre",
  preposition: "preposición",
  conjunction: "conjunción",
  article: "artículo",
  interjection: "interjección",
  expression: "expresión",
  phrase: "expresión",
  idiom: "modismo",
  number: "número",
  determiner: "determinante",
};

const VOCAB_SOURCE_LABELS: Record<string, string> = {
  karaoke: "Karaoke",
  quick_lookup: "Toque rápido",
  vocab_list: "Lista de vocabulario",
  "sin marcar": "Sin marcar",
};

/**
 * Aprendizaje. Solo dos señales, porque son las dos que la app emite de
 * verdad: sesiones de práctica (con su precisión) y consultas de
 * vocabulario. El progreso por tema de journey NO está aquí a propósito:
 * `journey_topic_checkpoint_complete` no tiene ni una fila y
 * `journey_story_read` se quedó en cinco de mayo de 2026 porque solo lo
 * dispara el web. Un panel a cero se lee como "nadie practica" cuando en
 * realidad dice "nadie mide".
 */
export function LearningView({
  learning,
}: {
  learning: DashboardData["learning"];
}) {
  const { practice, vocab, byLanguage, byLevel, levelUnattributed } = learning;
  const hasPractice = practice.started > 0 || practice.completed > 0;
  const hasVocab = vocab.lookups > 0;
  const maxModeVolume = Math.max(
    1,
    ...practice.byMode.map((m) => m.started + m.completed)
  );
  const maxBucketSessions = Math.max(
    1,
    ...practice.accuracyDistribution.map((b) => b.sessions)
  );
  const maxWordLookups = Math.max(1, ...vocab.topWords.map((w) => w.lookups));

  if (!hasPractice && !hasVocab) {
    return (
      <div className="mx-view">
        <EmptyPanel
          eyebrow="Sin datos"
          title="Sin actividad de aprendizaje en el rango"
          description="Nadie ha practicado ni consultado vocabulario entre estas fechas. Amplía el rango o quita los filtros de libro e historia."
        />
      </div>
    );
  }

  return (
    <div className="mx-view">
      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Práctica</div>
            <h3 className="mx-panel__title">Sesiones y precisión</h3>
          </div>
          <span className="mx-panel__hint">
            la precisión se mide solo sobre sesiones terminadas
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Sesiones iniciadas" value={practice.started} />
          <KpiCard
            label="Sesiones completadas"
            value={practice.completed}
            accent="xp"
            hint={`${practice.completionRate}% de las iniciadas`}
          />
          <KpiCard
            label="Precisión media"
            value={practice.avgAccuracyPercent}
            suffix="%"
            accent="gold"
          />
          <KpiCard label="Usuarios que practican" value={practice.practicingUsers} />
          <KpiCard
            label="Sesiones por usuario"
            value={
              practice.practicingUsers > 0
                ? Math.round(
                    (practice.completed / practice.practicingUsers) * 10
                  ) / 10
                : 0
            }
            accent="cyan"
          />
        </div>

        {practice.byMode.length > 0 && (
          <>
            <div className="mx-panel__sub">Por modo de ejercicio</div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
              >
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.6 }}>
                    <th style={{ padding: "4px 6px" }}>Modo</th>
                    <th style={{ padding: "4px 6px" }}>Volumen</th>
                    <th style={{ padding: "4px 6px", textAlign: "right" }}>
                      Iniciadas
                    </th>
                    <th style={{ padding: "4px 6px", textAlign: "right" }}>
                      Completadas
                    </th>
                    <th style={{ padding: "4px 6px", textAlign: "right" }}>
                      Finalización
                    </th>
                    <th style={{ padding: "4px 6px", textAlign: "right" }}>
                      Precisión
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {practice.byMode.map((m) => (
                    <tr
                      key={m.mode}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <td style={{ padding: "4px 6px" }}>
                        {PRACTICE_MODE_LABELS[m.mode] ?? m.mode}
                      </td>
                      <td style={{ padding: "4px 6px", width: "34%" }}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 5,
                            background: "var(--mx-bg-input)",
                            border: "1px solid var(--mx-border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.round(
                                ((m.started + m.completed) / maxModeVolume) * 100
                              )}%`,
                              height: "100%",
                              background: "var(--mx-accent)",
                              opacity: 0.85,
                            }}
                          />
                        </div>
                      </td>
                      <td
                        className="mx-mono"
                        style={{ padding: "4px 6px", textAlign: "right" }}
                      >
                        {fmt(m.started)}
                      </td>
                      <td
                        className="mx-mono"
                        style={{ padding: "4px 6px", textAlign: "right" }}
                      >
                        {fmt(m.completed)}
                      </td>
                      <td
                        className="mx-mono"
                        style={{ padding: "4px 6px", textAlign: "right" }}
                      >
                        {m.completionRate}%
                      </td>
                      <td
                        className="mx-mono"
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                          fontWeight: 700,
                        }}
                      >
                        {m.completed > 0 ? `${m.avgAccuracyPercent}%` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {practice.byMode.some((m) => m.completed > m.started) && (
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--mx-muted)",
                  margin: "8px 0 0",
                }}
              >
                Algún modo tiene más sesiones completadas que iniciadas: son
                sesiones que empezaron antes del rango y terminaron dentro. La
                finalización se muestra con tope en 100%.
              </p>
            )}
          </>
        )}

        {practice.completed > 0 && (
          <>
            <div className="mx-panel__sub">
              Distribución de precisión (sesiones terminadas)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {practice.accuracyDistribution.map((row) => (
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
                        width: `${Math.round(
                          (row.sessions / maxBucketSessions) * 100
                        )}%`,
                        height: "100%",
                        background: "var(--mx-xp)",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <span
                    className="mx-mono"
                    style={{
                      width: 60,
                      textAlign: "right",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--mx-fg)",
                    }}
                  >
                    {row.sessions}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Vocabulario</div>
            <h3 className="mx-panel__title">Palabras que frenan la lectura</h3>
          </div>
          <span className="mx-panel__hint">
            una consulta = un toque en una palabra del texto
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          <KpiCard label="Consultas" value={vocab.lookups} accent="cyan" />
          <KpiCard label="Palabras distintas" value={vocab.uniqueWords} />
          <KpiCard label="Usuarios que consultan" value={vocab.lookingUpUsers} />
          <KpiCard
            label="Consultas por usuario"
            value={vocab.lookupsPerReader}
            accent="gold"
          />
        </div>

        {vocab.bySource.length > 0 && (
          <>
            <div className="mx-panel__sub">De dónde sale la consulta</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {vocab.bySource.map((row) => (
                <span
                  key={row.source}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--mx-border)",
                    background: "var(--mx-bg-input)",
                    color: "var(--mx-fg-soft)",
                  }}
                >
                  {VOCAB_SOURCE_LABELS[row.source] ?? row.source}{" "}
                  <strong className="mx-mono" style={{ color: "var(--mx-fg)" }}>
                    {fmt(row.lookups)}
                  </strong>
                </span>
              ))}
            </div>
          </>
        )}

        {vocab.topWords.length > 0 ? (
          <>
            <div className="mx-panel__sub">Las 25 más consultadas</div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
              >
                <thead>
                  <tr style={{ textAlign: "left", opacity: 0.6 }}>
                    <th style={{ padding: "4px 6px" }}>Palabra</th>
                    <th style={{ padding: "4px 6px" }}>Idioma</th>
                    <th style={{ padding: "4px 6px" }}>Tipo</th>
                    <th style={{ padding: "4px 6px" }}>Consultas</th>
                    <th style={{ padding: "4px 6px", textAlign: "right" }}>
                      Usuarios
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vocab.topWords.map((w) => (
                    <tr
                      key={`${w.language ?? "?"}-${w.word}`}
                      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <td style={{ padding: "4px 6px", fontWeight: 600 }}>
                        {w.word}
                      </td>
                      <td style={{ padding: "4px 6px" }}>
                        <LangTag code={w.language} />
                      </td>
                      <td style={{ padding: "4px 6px", color: "var(--mx-muted)" }}>
                        {w.wordType
                          ? WORD_TYPE_LABELS[w.wordType.toLowerCase()] ?? w.wordType
                          : "-"}
                      </td>
                      <td style={{ padding: "4px 6px", width: "38%" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 12,
                              borderRadius: 5,
                              background: "var(--mx-bg-input)",
                              border: "1px solid var(--mx-border)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.round(
                                  (w.lookups / maxWordLookups) * 100
                                )}%`,
                                height: "100%",
                                background: "var(--mx-cyan)",
                                opacity: 0.85,
                              }}
                            />
                          </div>
                          <span
                            className="mx-mono"
                            style={{ width: 32, textAlign: "right", fontWeight: 700 }}
                          >
                            {w.lookups}
                          </span>
                        </div>
                      </td>
                      <td
                        className="mx-mono"
                        style={{ padding: "4px 6px", textAlign: "right" }}
                      >
                        {w.users}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--mx-muted)", margin: 0 }}>
            Ninguna consulta de vocabulario en el rango.
          </p>
        )}
      </div>

      <div className="mx-panel">
        <div className="mx-panel__head">
          <div>
            <div className="mx-panel__eyebrow">Reparto</div>
            <h3 className="mx-panel__title">Por idioma y por nivel</h3>
          </div>
          <span className="mx-panel__hint">
            el nivel sale de la historia practicada, no del perfil
          </span>
        </div>

        <div className="mx-panel__sub">Idioma</div>
        {byLanguage.length > 0 ? (
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
            >
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.6 }}>
                  <th style={{ padding: "4px 6px" }}>Idioma</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Consultas
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Prácticas
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Precisión
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Usuarios
                  </th>
                </tr>
              </thead>
              <tbody>
                {byLanguage.map((row) => (
                  <tr
                    key={row.language}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "4px 6px" }}>
                      <LangTag code={row.language} />
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {fmt(row.lookups)}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {fmt(row.practiceCompleted)}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700 }}
                    >
                      {row.practiceCompleted > 0
                        ? `${row.avgAccuracyPercent}%`
                        : "-"}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {row.users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--mx-muted)",
              margin: "0 0 14px",
            }}
          >
            Sin idioma resoluble en el rango.
          </p>
        )}

        <div className="mx-panel__sub">Nivel</div>
        {byLevel.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
            >
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.6 }}>
                  <th style={{ padding: "4px 6px" }}>Nivel</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Iniciadas
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Completadas
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Precisión
                  </th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>
                    Usuarios
                  </th>
                </tr>
              </thead>
              <tbody>
                {byLevel.map((row) => (
                  <tr
                    key={row.level}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textTransform: "uppercase" }}
                    >
                      {row.level}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {fmt(row.practiceStarted)}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {fmt(row.practiceCompleted)}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700 }}
                    >
                      {row.practiceCompleted > 0
                        ? `${row.avgAccuracyPercent}%`
                        : "-"}
                    </td>
                    <td
                      className="mx-mono"
                      style={{ padding: "4px 6px", textAlign: "right" }}
                    >
                      {row.users}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--mx-muted)", margin: 0 }}>
            Ninguna sesión de práctica pudo atribuirse a un nivel. Pasa cuando
            se practica sobre historias que no están en ningún catálogo con
            nivel declarado.
          </p>
        )}

        {levelUnattributed.sessions > 0 && (
          <p
            style={{
              fontSize: 11.5,
              color: "var(--mx-muted)",
              margin: "10px 0 0",
            }}
          >
            {levelUnattributed.sessions} sesiones quedan fuera de esta tabla
            {levelUnattributed.placeholder > 0 && (
              <>
                {" "}
                ({levelUnattributed.placeholder} sin historia asociada
                {levelUnattributed.unknownStory > 0
                  ? `, ${levelUnattributed.unknownStory} sobre historias sin nivel CEFR declarado`
                  : ""}
                )
              </>
            )}
            {levelUnattributed.placeholder === 0 && (
              <> (historias sin nivel CEFR declarado)</>
            )}
            , así que sus totales no suman los de arriba.
          </p>
        )}
      </div>
    </div>
  );
}
