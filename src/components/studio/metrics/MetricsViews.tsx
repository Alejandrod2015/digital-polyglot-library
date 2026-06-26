"use client";

import { useMemo } from "react";
import {
  AreaChart,
  BarRow,
  EmptyPanel,
  FunnelChart,
  InsightCard,
  KpiCard,
  LangTag,
  fmt,
} from "./MetricsPrimitives";
import { deriveInsights } from "./deriveInsights";
import { sparkSeries, toAreaChartData } from "./dailyHelpers";
import type { DashboardData } from "./types";

/**
 * The three primary views (Resumen, Engagement, Funnels) of the
 * redesigned studio metrics dashboard. Each view reads the same
 * `data` payload and renders a dense, editorial layout built on the
 * `.mx-*` design tokens defined in globals.css. Other tabs keep
 * their existing renderers in page.tsx.
 */

// ── ResumenView ──────────────────────────────────────────
export function ResumenView({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const p = data.prevKpis;
  const chartData = useMemo(() => toAreaChartData(data.daily), [data.daily]);
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

  const insights = useMemo(
    () =>
      deriveInsights({
        curr: k,
        prev: p,
        topStoriesByMinutes: data.topStoriesByMinutes,
        topSavedStories: data.topSavedStories,
        reminderFunnel: data.reminderFunnel,
      }),
    [k, p, data.topStoriesByMinutes, data.topSavedStories, data.reminderFunnel]
  );

  const maxStoryMinutes =
    data.topStoriesByMinutes[0]?.listenedMinutes ?? 0;
  const maxSavedStory = data.topSavedStories[0]?.saves ?? 0;
  const maxSavedBook = data.topSavedBooks[0]?.saves ?? 0;

  return (
    <div className="mx-view">
      <div className="mx-hero-grid">
        <KpiCard
          hero
          label="DAU"
          value={k.dau}
          prev={p?.dau}
          spark={sparkPlays}
          accent="accent"
          hint="usuarios activos hoy"
        />
        <KpiCard
          hero
          label="WAU"
          value={k.wau}
          prev={p?.wau}
          spark={sparkPlays}
          accent="cyan"
          hint="últimos 7 días"
        />
        <KpiCard
          hero
          label="Plays"
          value={k.plays}
          prev={p?.plays}
          spark={sparkPlays}
          accent="accent"
          hint={`reproducciones · ${data.range.days}d`}
        />
        <KpiCard
          hero
          label="Completion rate"
          value={k.completionRate}
          suffix="%"
          prev={p?.completionRate}
          spark={sparkCr}
          accent="xp"
          hint="completadas / iniciadas"
        />
        <KpiCard
          hero
          label="Total escuchado"
          value={k.totalListenedMinutes}
          suffix="min"
          prev={p?.totalListenedMinutes}
          spark={sparkCompletions}
          accent="gold"
          hint="suma de minutos"
        />
      </div>

      <div className="mx-subkpi-grid">
        <KpiCard
          label="Active users"
          value={k.activeUsersInRange}
          prev={p?.activeUsersInRange}
        />
        <KpiCard
          label="Completions"
          value={k.completions}
          prev={p?.completions}
          accent="xp"
        />
        <KpiCard
          label="Unique stories"
          value={k.uniqueStories}
          prev={p?.uniqueStories}
        />
        <KpiCard
          label="Unique books"
          value={k.uniqueBooks}
          prev={p?.uniqueBooks}
        />
        <KpiCard
          label="Avg min/user"
          value={k.avgMinutesPerActiveUser}
          prev={p?.avgMinutesPerActiveUser}
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
        <KpiCard
          label="Trial → Pago"
          value={data.trialFunnel.conversionRate}
          suffix="%"
          accent="xp"
        />
      </div>

      <div className="mx-row mx-row--chart">
        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Tendencia diaria</div>
              <h3 className="mx-panel__title">Plays vs. completions</h3>
            </div>
            <div className="mx-legend">
              <span className="mx-legend__item">
                <span
                  className="mx-legend__dot"
                  style={{ background: "var(--mx-accent)" }}
                />{" "}
                Plays
              </span>
              <span className="mx-legend__item">
                <span
                  className="mx-legend__dot"
                  style={{ background: "var(--mx-xp)" }}
                />{" "}
                Completions
              </span>
              <span className="mx-legend__divider" />
              <span className="mx-legend__pill">{data.range.days} días</span>
            </div>
          </div>
          <AreaChart data={chartData} height={300} />
        </div>

        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Insights automáticos</div>
              <h3 className="mx-panel__title">Lo que cambió</h3>
            </div>
          </div>
          <div className="mx-insight-list">
            {insights.map((insight, i) => (
              <InsightCard key={`${insight.title}-${i}`} {...insight} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-row mx-row--2up">
        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Top contenido</div>
              <h3 className="mx-panel__title">Historias más escuchadas</h3>
            </div>
            <span className="mx-panel__hint">minutos · listeners</span>
          </div>
          <div className="mx-barlist">
            {data.topStoriesByMinutes.slice(0, 8).map((story) => {
              const lang = story.language;
              return (
                <BarRow
                  key={story.storySlug}
                  label={story.storySlug}
                  value={story.listenedMinutes}
                  max={maxStoryMinutes || 1}
                  suffix="min"
                  sub={`${story.listeners} listeners`}
                  tag={lang ? <LangTag code={lang} /> : null}
                  accent="var(--mx-accent)"
                />
              );
            })}
            {data.topStoriesByMinutes.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin datos en el rango seleccionado.
              </p>
            )}
          </div>
        </div>

        <div className="mx-panel">
          <div className="mx-panel__head">
            <div>
              <div className="mx-panel__eyebrow">Saves</div>
              <h3 className="mx-panel__title">Historias más guardadas</h3>
            </div>
            <span className="mx-panel__hint">señal editorial</span>
          </div>
          <div className="mx-barlist">
            {data.topSavedStories.map((story) => (
              <BarRow
                key={story.storySlug}
                label={story.storySlug}
                value={story.saves}
                max={maxSavedStory || 1}
                suffix="saves"
                accent="var(--mx-gems)"
              />
            ))}
            {data.topSavedStories.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin saves en el rango.
              </p>
            )}
          </div>

          <div className="mx-panel__head" style={{ marginTop: 20 }}>
            <div>
              <div className="mx-panel__eyebrow">Saves</div>
              <h3 className="mx-panel__title">Libros más guardados</h3>
            </div>
          </div>
          <div className="mx-barlist">
            {data.topSavedBooks.map((book) => (
              <BarRow
                key={book.bookSlug}
                label={book.bookSlug}
                value={book.saves}
                max={maxSavedBook || 1}
                suffix="saves"
                accent="var(--mx-gold)"
              />
            ))}
            {data.topSavedBooks.length === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--mx-muted)" }}>
                Sin saves en el rango.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EngagementView ───────────────────────────────────────
export function EngagementView({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const p = data.prevKpis;
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

  const totalSaves = k.savedStories + k.savedBooks;
  const prevSaves =
    p !== undefined ? p.savedStories + p.savedBooks : undefined;

  return (
    <div className="mx-view">
      <div className="mx-subkpi-grid">
        <KpiCard
          label="Plays"
          value={k.plays}
          prev={p?.plays}
          spark={sparkPlays}
          accent="accent"
        />
        <KpiCard
          label="Completions"
          value={k.completions}
          prev={p?.completions}
          spark={sparkCompletions}
          accent="xp"
        />
        <KpiCard
          label="Completion rate"
          value={k.completionRate}
          suffix="%"
          prev={p?.completionRate}
          spark={sparkCr}
          accent="xp"
        />
        <KpiCard
          label="Avg min / user"
          value={k.avgMinutesPerActiveUser}
          prev={p?.avgMinutesPerActiveUser}
          accent="gold"
        />
        <KpiCard
          label="Total escuchado"
          value={k.totalListenedMinutes}
          suffix="min"
          prev={p?.totalListenedMinutes}
          spark={sparkCompletions}
          accent="gold"
        />
        <KpiCard
          label="Unique stories"
          value={k.uniqueStories}
          prev={p?.uniqueStories}
        />
        <KpiCard
          label="Unique books"
          value={k.uniqueBooks}
          prev={p?.uniqueBooks}
        />
        <KpiCard
          label="Saves totales"
          value={totalSaves}
          prev={prevSaves}
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
