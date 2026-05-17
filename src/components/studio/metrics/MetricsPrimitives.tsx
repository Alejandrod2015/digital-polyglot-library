"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Shared visual primitives for the studio metrics dashboard. The
 * design tokens live in globals.css under the `--mx-*` namespace;
 * components below are intentionally token-driven (no per-component
 * stylesheets) so accent + density tweaks propagate everywhere.
 */

const esES = "es-ES";

export function fmt(n: number | string): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toLocaleString(esES);
  return n.toLocaleString(esES, { maximumFractionDigits: 1 });
}

export function pctChange(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

// ── LangTag ──────────────────────────────────────────────
const LANG_HUE: Record<string, string> = {
  es: "var(--mx-streak)",
  it: "var(--mx-gold)",
  de: "var(--mx-cyan)",
  fr: "var(--mx-gems)",
  pt: "var(--mx-pos)",
  en: "var(--mx-fg-soft)",
};

export function LangTag({ code }: { code?: string | null }) {
  const normalized = (code ?? "").toLowerCase();
  const hue = LANG_HUE[normalized] ?? "var(--mx-muted)";
  const label = normalized ? normalized.toUpperCase() : "—";
  return (
    <span className="mx-langtag" style={{ color: hue, borderColor: hue }}>
      {label}
    </span>
  );
}

// ── Sparkline ────────────────────────────────────────────
type SparklineProps = {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
};

export function Sparkline({
  data,
  color = "var(--mx-accent)",
  height = 28,
  width = 96,
  fill = true,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points = data.map((v, i) => [
    i * stepX,
    height - 2 - ((v - min) / range) * (height - 4),
  ] as const);
  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  const last = points[points.length - 1];
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden>
      {fill && <path d={fillPath} fill={color} opacity="0.14" />}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}

// ── DeltaPill ────────────────────────────────────────────
type DeltaPillProps = {
  current: number;
  previous?: number;
  inverted?: boolean;
};

export function DeltaPill({ current, previous, inverted = false }: DeltaPillProps) {
  if (typeof previous !== "number" || previous === 0) return null;
  const d = pctChange(current, previous);
  const isUp = d >= 0;
  const isGood = inverted ? !isUp : isUp;
  const color =
    Math.abs(d) < 0.5
      ? "var(--mx-muted)"
      : isGood
        ? "var(--mx-pos)"
        : "var(--mx-neg)";
  return (
    <span className="mx-delta" style={{ color }}>
      <span style={{ fontSize: 9 }}>{isUp ? "▲" : "▼"}</span>
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}

// ── KpiCard ──────────────────────────────────────────────
type KpiAccentKey = "accent" | "cyan" | "xp" | "gold" | "gems";

const ACCENT_VAR: Record<KpiAccentKey, string> = {
  accent: "var(--mx-accent)",
  cyan: "var(--mx-cyan)",
  xp: "var(--mx-xp)",
  gold: "var(--mx-gold)",
  gems: "var(--mx-gems)",
};

type KpiCardProps = {
  label: string;
  value: number | string;
  prev?: number;
  suffix?: string;
  spark?: number[];
  accent?: KpiAccentKey;
  hero?: boolean;
  hint?: string;
  inverted?: boolean;
};

export function KpiCard({
  label,
  value,
  prev,
  suffix,
  spark,
  accent = "accent",
  hero = false,
  hint,
  inverted = false,
}: KpiCardProps) {
  const accentColor = ACCENT_VAR[accent];
  const dataAccent = accent === "accent" ? undefined : accent;
  const numericValue = typeof value === "number" ? value : Number(value);
  return (
    <div
      className={hero ? "mx-kpi mx-kpi--hero" : "mx-kpi"}
      data-accent={dataAccent}
    >
      <div className="mx-kpi__head">
        <div className="mx-kpi__label">{label}</div>
        {typeof prev === "number" && Number.isFinite(numericValue) && (
          <DeltaPill current={numericValue} previous={prev} inverted={inverted} />
        )}
      </div>
      <div className="mx-kpi__value-row">
        <div className="mx-kpi__value">
          {fmt(value)}
          {suffix && <span className="mx-kpi__suffix">{suffix}</span>}
        </div>
        {spark && spark.length > 0 && (
          <Sparkline
            data={spark}
            color={accentColor}
            width={hero ? 88 : 64}
            height={hero ? 32 : 24}
          />
        )}
      </div>
      {hint && <div className="mx-kpi__hint">{hint}</div>}
    </div>
  );
}

// ── AreaChart ────────────────────────────────────────────
export type AreaChartDatum = {
  date: string;
  label: string;
  plays: number;
  completions: number;
};

type AreaChartProps = {
  data: AreaChartDatum[];
  height?: number;
};

export function AreaChart({ data, height = 280 }: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "var(--mx-muted)",
          fontSize: 12,
        }}
      >
        No data for the selected range.
      </div>
    );
  }
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const w = 1000;
  const h = height;
  const innerW = w - padding.left - padding.right;
  const innerH = h - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...data.map((d) => d.plays),
    ...data.map((d) => d.completions),
    1
  );
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;
  const stepX = innerW / (data.length - 1 || 1);

  const buildPath = (key: "plays" | "completions") => {
    const pts = data.map(
      (d, i) =>
        [
          padding.left + i * stepX,
          padding.top + innerH - (d[key] / niceMax) * innerH,
        ] as const
    );
    let path = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      path += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return { path, points: pts };
  };

  const plays = buildPath("plays");
  const completions = buildPath("completions");
  const playsFill = `${plays.path} L${padding.left + innerW},${padding.top + innerH} L${padding.left},${padding.top + innerH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const xTickEvery = Math.max(1, Math.floor(data.length / 7));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {yTicks.map((t, i) => {
        const y = padding.top + innerH - (t / niceMax) * innerH;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={w - padding.right}
              y2={y}
              stroke="var(--mx-grid)"
              strokeDasharray="2 4"
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              fill="var(--mx-muted)"
              fontSize="11"
              textAnchor="end"
              fontFamily="var(--mx-mono)"
            >
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        if (i % xTickEvery !== 0 && i !== data.length - 1) return null;
        const x = padding.left + i * stepX;
        return (
          <text
            key={`${d.date}-${i}`}
            x={x}
            y={h - 8}
            fill="var(--mx-muted)"
            fontSize="10.5"
            textAnchor="middle"
            fontFamily="var(--mx-mono)"
          >
            {d.label}
          </text>
        );
      })}
      <path d={playsFill} fill="var(--mx-accent)" opacity="0.18" />
      <path d={plays.path} fill="none" stroke="var(--mx-accent)" strokeWidth="2" />
      <path
        d={completions.path}
        fill="none"
        stroke="var(--mx-xp)"
        strokeWidth="2"
      />
      <circle
        cx={plays.points[plays.points.length - 1][0]}
        cy={plays.points[plays.points.length - 1][1]}
        r="3.5"
        fill="var(--mx-accent)"
      />
      <circle
        cx={completions.points[completions.points.length - 1][0]}
        cy={completions.points[completions.points.length - 1][1]}
        r="3.5"
        fill="var(--mx-xp)"
      />
    </svg>
  );
}

// ── BarRow ───────────────────────────────────────────────
type BarRowProps = {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  sub?: string;
  tag?: ReactNode;
  accent?: string;
};

export function BarRow({
  label,
  value,
  max,
  suffix,
  sub,
  tag,
  accent = "var(--mx-accent)",
}: BarRowProps) {
  const widthPct = max === 0 ? 0 : (value / max) * 100;
  return (
    <div className="mx-barrow">
      <div className="mx-barrow__top">
        {tag && <span className="mx-barrow__tag">{tag}</span>}
        <span className="mx-barrow__label" title={label}>
          {label}
        </span>
        <span className="mx-barrow__value">
          <strong>{fmt(value)}</strong>
          {suffix && <span className="mx-barrow__suffix"> {suffix}</span>}
        </span>
      </div>
      <div className="mx-barrow__track">
        <div
          className="mx-barrow__fill"
          style={{ width: `${widthPct}%`, background: accent }}
        />
      </div>
      {sub && <div className="mx-barrow__sub">{sub}</div>}
    </div>
  );
}

// ── FunnelChart ──────────────────────────────────────────
type FunnelStep = { label: string; value: number };
type FunnelChartProps = { steps: FunnelStep[]; accent?: string };

export function FunnelChart({ steps, accent = "var(--mx-accent)" }: FunnelChartProps) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="mx-funnel">
      {steps.map((step, i) => {
        const widthPct = (step.value / max) * 100;
        const prev = i === 0 ? null : steps[i - 1];
        const rate =
          prev && prev.value > 0 ? (step.value / prev.value) * 100 : null;
        const rateColor =
          rate !== null && rate < 50 ? "var(--mx-warn)" : "var(--mx-muted)";
        return (
          <div className="mx-funnel__row" key={`${step.label}-${i}`}>
            <div className="mx-funnel__meta">
              <div className="mx-funnel__step">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mx-funnel__label">{step.label}</div>
            </div>
            <div className="mx-funnel__bar-wrap">
              <div
                className="mx-funnel__bar"
                style={{ width: `${widthPct}%`, background: accent }}
              >
                <span className="mx-funnel__value">{fmt(step.value)}</span>
              </div>
              {rate !== null && (
                <div className="mx-funnel__rate" style={{ color: rateColor }}>
                  → {rate.toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── InsightCard ──────────────────────────────────────────
export type Insight = {
  kind: "up" | "down" | "warn" | "info";
  title: string;
  body: string;
  tag?: string;
};

const INSIGHT_MAP: Record<
  Insight["kind"],
  { glyph: string; color: string }
> = {
  up: { glyph: "▲", color: "var(--mx-pos)" },
  down: { glyph: "▼", color: "var(--mx-neg)" },
  warn: { glyph: "!", color: "var(--mx-warn)" },
  info: { glyph: "i", color: "var(--mx-cyan)" },
};

export function InsightCard({ kind, title, body, tag }: Insight) {
  const m = INSIGHT_MAP[kind] ?? INSIGHT_MAP.info;
  return (
    <div className="mx-insight">
      <div
        className="mx-insight__glyph"
        style={{ color: m.color, borderColor: m.color }}
      >
        {m.glyph}
      </div>
      <div className="mx-insight__body">
        <div className="mx-insight__head">
          <span className="mx-insight__title">{title}</span>
          {tag && <span className="mx-insight__tag">{tag}</span>}
        </div>
        <div className="mx-insight__copy">{body}</div>
      </div>
    </div>
  );
}

// ── Empty section helper ─────────────────────────────────
export function EmptyPanel({
  title,
  description,
  style,
}: {
  title: string;
  description: string;
  style?: CSSProperties;
}) {
  return (
    <div className="mx-panel" style={style}>
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Próximamente</div>
          <h3 className="mx-panel__title">{title}</h3>
        </div>
      </div>
      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--mx-muted)",
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}
