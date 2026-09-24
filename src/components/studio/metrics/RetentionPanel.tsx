"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MetricsCohort } from "@/lib/metricsCohort";

/**
 * Cohorte diaria de altas tal como la trae `/api/metrics/acquisition` en
 * `retentionDaily.cohorts`. `cells[n]` es el dia n desde el alta; `partial`
 * marca que no toda la cohorte ha llegado aun a ese dia.
 */
export type RetentionDailyCohort = {
  start: string;
  users: number;
  cells: Array<{ retained: number; pct: number; partial: boolean }>;
};

type Milestone = "d1" | "d3" | "d7" | "d14";
type Mode = "week" | "day";
type Platform = "all" | "web" | "ios" | "android";

const MILESTONES: Array<{ key: Milestone; day: number; label: string; color: string }> = [
  { key: "d1", day: 1, label: "D1", color: "var(--mx-accent)" },
  { key: "d3", day: 3, label: "D3", color: "var(--mx-cyan)" },
  { key: "d7", day: 7, label: "D7", color: "var(--mx-gems)" },
  { key: "d14", day: 14, label: "D14", color: "var(--mx-mint, var(--mx-xp))" },
];

const VERB: Record<Milestone, [string, string]> = {
  d1: ["volvió al día siguiente", "volvieron al día siguiente"],
  d3: ["seguía a los 3 días", "seguían a los 3 días"],
  d7: ["seguía a los 7 días", "seguían a los 7 días"],
  d14: ["seguía a los 14 días", "seguían a los 14 días"],
};

/** Retenidos y elegibles de un hito dentro de una cohorte (diaria o semanal). */
type Cell = { retained: number; eligible: number; partial?: boolean };

type CohortPoint = {
  /** MM-DD del dia de alta, o del lunes de la semana. */
  label: string;
  users: number;
  /** null: nadie de la cohorte ha llegado aun a ese dia. */
  cells: Record<Milestone, Cell | null>;
  /** Solo en la vista diaria: el dia aun no ha cerrado su ventana. */
  inProgress?: boolean;
};

function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Semanas de alta a partir de las cohortes diarias. Un hito cuenta a las
 * altas que YA llegaron a ese dia (las celdas no `partial`); las que se
 * registraron demasiado tarde no entran ni en el numerador ni en el
 * denominador. Asi la semana en curso se compara de forma justa con las
 * cerradas: 2 de 13 maduras es 15%, no 2 de 16.
 */
export function aggregateWeeklyRetention(cohorts: RetentionDailyCohort[]): CohortPoint[] {
  const weeks = new Map<string, { users: number; acc: Record<Milestone, Cell> }>();
  for (const c of cohorts) {
    const key = mondayOf(c.start);
    const w = weeks.get(key) ?? {
      users: 0,
      acc: {
        d1: { retained: 0, eligible: 0 },
        d3: { retained: 0, eligible: 0 },
        d7: { retained: 0, eligible: 0 },
        d14: { retained: 0, eligible: 0 },
      },
    };
    w.users += c.users;
    for (const m of MILESTONES) {
      const cell = c.cells[m.day];
      if (cell && !cell.partial) {
        w.acc[m.key].retained += cell.retained;
        w.acc[m.key].eligible += c.users;
      }
    }
    weeks.set(key, w);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, w]) => ({
      label: weekStart.slice(5),
      users: w.users,
      cells: {
        d1: w.acc.d1.eligible > 0 ? w.acc.d1 : null,
        d3: w.acc.d3.eligible > 0 ? w.acc.d3 : null,
        d7: w.acc.d7.eligible > 0 ? w.acc.d7 : null,
        d14: w.acc.d14.eligible > 0 ? w.acc.d14 : null,
      },
    }));
}

/**
 * Cohortes diarias tal cual, mas recientes a la derecha. Un dia que aun no
 * ha cerrado su ventana solo pinta un hito si alguien ya volvio (un 0 de un
 * dia a medias seria ruido); D1 se pinta siempre porque es el que se mira.
 */
export function dailyRetention(cohorts: RetentionDailyCohort[]): CohortPoint[] {
  if (cohorts.length === 0) return [];
  // La API solo trae los dias con altas; los dias sin altas se rellenan
  // vacios para que el eje sea un calendario y los huecos se vean.
  const byStart = new Map(cohorts.map((c) => [c.start, c]));
  const starts = [...byStart.keys()].sort();
  const filled: RetentionDailyCohort[] = [];
  const cursor = new Date(`${starts[0]}T00:00:00Z`);
  const end = new Date(`${starts[starts.length - 1]}T00:00:00Z`);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    filled.push(byStart.get(iso) ?? { start: iso, users: 0, cells: [] });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return filled
    .map((c) => {
      const cells = {} as Record<Milestone, Cell | null>;
      for (const m of MILESTONES) {
        const cell = c.cells[m.day];
        if (!cell || c.users === 0) {
          cells[m.key] = null;
          continue;
        }
        if (cell.partial) {
          cells[m.key] =
            m.key === "d1" || cell.retained > 0
              ? { retained: cell.retained, eligible: c.users, partial: true }
              : null;
        } else {
          cells[m.key] = { retained: cell.retained, eligible: c.users };
        }
      }
      // "en curso" = el dia aun no ha cumplido ni su D1
      const inProgress = Boolean(c.cells[1]?.partial) && c.users > 0;
      return { label: c.start.slice(5), users: c.users, cells, inProgress };
    });
}

const pct = (c: Cell) => (c.eligible > 0 ? (c.retained / c.eligible) * 100 : 0);
const fmtPct = (v: number) => `${Math.round(v)}%`;

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mx = (a.x + b.x) / 2;
    d += ` C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

type ChipInfo = { value: string; tip: string };

/** Chip de cabecera en modo Semana: la ultima semana entera que ya cumplio el hito. */
function weeklyChip(weeks: CohortPoint[], m: (typeof MILESTONES)[number]): ChipInfo {
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    const c = w.cells[m.key];
    if (c && c.eligible === w.users) {
      const verb = VERB[m.key][c.retained === 1 ? 0 : 1];
      return {
        value: fmtPct(pct(c)),
        tip: `Última semana entera que ya cumplió ${m.label}: la del ${w.label}. De sus ${w.users} altas, ${c.retained} ${verb}. Las semanas más nuevas aún no han llegado a ese día.`,
      };
    }
  }
  return { value: "sin dato", tip: `Ninguna semana entera ha llegado todavía al día ${m.day}.` };
}

/** Chip en modo Dia: los 7 dias de alta mas recientes que ya cumplieron el hito, sumados. */
function dailyChip(days: CohortPoint[], m: (typeof MILESTONES)[number]): ChipInfo {
  let retained = 0;
  let eligible = 0;
  let n = 0;
  let first = "";
  let last = "";
  for (let i = days.length - 1; i >= 0 && n < 7; i--) {
    const d = days[i];
    const c = d.cells[m.key];
    if (!c || c.partial) continue;
    retained += c.retained;
    eligible += c.eligible;
    if (!last) last = d.label;
    first = d.label;
    n++;
  }
  if (eligible === 0) return { value: "sin dato", tip: `Ningún día de alta ha llegado todavía al día ${m.day}.` };
  const verb = VERB[m.key][retained === 1 ? 0 : 1];
  return {
    value: fmtPct((retained / eligible) * 100),
    tip: `Los ${n} días de alta más recientes que ya cumplieron ${m.label} (del ${first} al ${last}), sumados: ${retained} de ${eligible} ${verb}. No es la misma ventana que en Semana, por eso el número cambia.`,
  };
}

const MODE_OPTIONS = [
  { key: "day" as const, label: "Día" },
  { key: "week" as const, label: "Semana" },
];

export function RetentionPanel({
  days,
  cohort,
  rangeLabel,
  platform,
}: {
  days: number;
  cohort: MetricsCohort;
  rangeLabel: string;
  /** El selector de plataforma sigue viviendo en la cabecera del tablero. */
  platform: Platform;
}) {
  const [cohorts, setCohorts] = useState<RetentionDailyCohort[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  // Dia o semana es cosa de ESTE panel, no del grano global del tablero: una
  // cohorte diaria con pocas altas salta tanto que no se lee, asi que entra
  // en semana y quien quiera el detalle lo pide aqui.
  const [mode, setMode] = useState<Mode>("week");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/acquisition?days=${days}&cohort=${cohort}&platform=${platform}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: { retentionDaily?: { cohorts: RetentionDailyCohort[] } }) => {
        if (!cancelled) setCohorts(j.retentionDaily?.cohorts ?? []);
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
  }, [days, cohort, platform]);

  const weekly = useMemo(() => (cohorts ? aggregateWeeklyRetention(cohorts) : []), [cohorts]);
  const daily = useMemo(() => (cohorts ? dailyRetention(cohorts) : []), [cohorts]);
  const points = mode === "week" ? weekly : daily;
  const totalUsers = useMemo(() => (cohorts ?? []).reduce((s, c) => s + c.users, 0), [cohorts]);

  const chips = MILESTONES.map((m) => ({
    m,
    info: mode === "week" ? weeklyChip(weekly, m) : dailyChip(daily, m),
  }));

  return (
    <div className="mx-panel">
      <div className="mx-panel__head">
        <div
          onClick={() => setOpen((v) => !v)}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
        >
          <span
            style={{
              color: "var(--mx-muted)",
              fontSize: 10,
              marginTop: 7,
              transform: open ? "rotate(90deg)" : undefined,
              transition: "transform 0.15s",
            }}
          >
            ▸
          </span>
          <div>
            <div className="mx-panel__eyebrow">Retención total</div>
            <h3 className="mx-panel__title">Vuelven, por cohorte de alta</h3>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span className="mx-panel__hint" style={{ marginTop: 0 }}>
            {error
              ? `error: ${error}`
              : loading
                ? "cargando…"
                : `cohortes: ${totalUsers} altas, ${rangeLabel}`}
          </span>
          <div className="mx-segmented">
            {MODE_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.key}
                onClick={() => setMode(o.key)}
                className={
                  mode === o.key
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

      {open && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {chips.map(({ m, info }) => (
              <div key={m.key} className="mx-rchip" style={{ ["--rchip" as string]: m.color } as React.CSSProperties}>
                <span className="mx-rchip__dot" />
                <span className="mx-rchip__label">{m.label}</span>
                <span className="mx-rchip__value">{info.value}</span>
                <div className="mx-rchip__tip">{info.tip}</div>
              </div>
            ))}
            <span style={{ fontSize: 10.5, color: "var(--mx-muted-soft)", whiteSpace: "nowrap" }}>
              {mode === "week"
                ? "última semana entera que llegó a cada hito · pasa el cursor"
                : "últimos 7 días de alta que llegaron a cada hito, sumados · pasa el cursor"}
            </span>
          </div>

          {/*
            Aqui habia cuatro lineas explicando como se lee la grafica. Fuera
            por decision del usuario: lo que el punto significa ya lo dice el
            globo al pasar el cursor, y el parrafo ocupaba mas alto que la
            propia curva.
          */}
          <RetentionChart points={points} mode={mode} />
        </>
      )}
    </div>
  );
}

type Hit = {
  x: number;
  y: number;
  r: number;
  color: string;
  key: Milestone;
  label: string;
  cohortLabel: string;
  cell: Cell;
};

const PAD = { top: 18, right: 16, bottom: 44, left: 36 };
const CHART_H = 246;

/**
 * Cuatro lineas (D1, D3, D7, D14) por cohorte de alta, con el viewBox al
 * ancho real del contenedor para que los circulos sean circulos. Sin area
 * bajo las series secundarias: con cohortes de un punado de personas, cuatro
 * areas encimadas se leen peor que cuatro lineas.
 */
function RetentionChart({ points, mode }: { points: CohortPoint[]; mode: Mode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<Hit | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div
        ref={ref}
        style={{ height: CHART_H, display: "grid", placeItems: "center", color: "var(--mx-muted)", fontSize: 12 }}
      >
        Todavía no hay suficientes cohortes de altas para trazar la curva.
      </div>
    );
  }

  const w = width;
  const h = CHART_H;
  const x0 = PAD.left;
  const x1 = w - PAD.right;
  const y0 = h - PAD.bottom;
  const innerH = y0 - PAD.top;
  const n = points.length;
  const xAt = (i: number) => x0 + (i * (x1 - x0)) / (n - 1);
  const yAt = (v: number) => y0 - (v / 100) * innerH;
  const maxUsers = Math.max(1, ...points.map((p) => p.users));
  const base = mode === "week" ? 3 : 2.4;
  const rAt = (u: number) => base + Math.sqrt(u / maxUsers) * 3.2;
  const labelEvery = mode === "week" ? 1 : Math.max(1, Math.floor(n / 5));
  const lastIdx = n - 1;

  const hits: Hit[] = [];
  const series = MILESTONES.map((m) => {
    const runs: Array<Array<{ x: number; y: number }>> = [];
    let run: Array<{ x: number; y: number }> = [];
    points.forEach((p, i) => {
      const c = p.cells[m.key];
      if (!c) {
        if (run.length) runs.push(run);
        run = [];
        return;
      }
      const pt = { x: xAt(i), y: yAt(pct(c)) };
      run.push(pt);
      const cohortLabel =
        mode === "week"
          ? c.eligible < p.users
            ? `sem. ${p.label} · ${c.eligible} maduras de ${p.users} altas`
            : `sem. ${p.label} · ${p.users} altas`
          : `${p.label} · ${p.users} alta${p.users === 1 ? "" : "s"}${c.partial ? " · en curso" : ""}`;
      hits.push({ ...pt, r: rAt(p.users), color: m.color, key: m.key, label: m.label, cohortLabel, cell: c });
    });
    if (run.length) runs.push(run);
    return { m, runs };
  });

  const d1 = series[0];
  const d1Pts = d1.runs.flat();
  const fill =
    mode === "week" && d1Pts.length > 1
      ? `${smoothPath(d1Pts)} L${d1Pts[d1Pts.length - 1].x},${y0} L${d1Pts[0].x},${y0} Z`
      : null;
  const liveD1 = points[lastIdx].cells.d1;
  const live = { x: xAt(lastIdx), y: liveD1 ? yAt(pct(liveD1)) : y0, r: liveD1 ? rAt(points[lastIdx].users) : 4.6 };

  const CH = 6.4;
  let tip: { x: number; y: number; w: number; l1: string; l2: string } | null = null;
  if (hover) {
    const l1 = `${hover.label} · ${hover.cohortLabel}`;
    const l2 = `${fmtPct(pct(hover.cell))} · ${hover.cell.retained} de ${hover.cell.eligible}`;
    const tw = Math.max(l1.length, l2.length) * CH + 18;
    const above = hover.y > 70;
    let tx = hover.x - tw / 2;
    if (tx < 4) tx = 4;
    if (tx + tw > w - 4) tx = w - 4 - tw;
    tip = { x: tx, y: above ? hover.y - hover.r - 10 - 36 : hover.y + hover.r + 10, w: tw, l1, l2 };
  }

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label="Retención D1, D3, D7 y D14 por cohorte de alta"
      >
        <defs>
          <filter id="mx-rt-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="mx-rt-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--mx-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--mx-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={x0}
              x2={x1}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke={v === 0 ? "var(--mx-border-strong)" : "var(--mx-grid)"}
            />
            <text
              x={x0 - 8}
              y={yAt(v) + 4}
              textAnchor="end"
              fontSize={10.5}
              fontFamily="var(--mx-mono)"
              fill="var(--mx-muted-soft)"
            >
              {v}
            </text>
          </g>
        ))}

        {fill && <path d={fill} fill="url(#mx-rt-fade)" />}

        {mode === "day" &&
          points.map((p, i) =>
            p.users > 0 ? (
              <line
                key={p.label}
                x1={xAt(i)}
                x2={xAt(i)}
                y1={y0}
                y2={y0 + 2 + Math.min(12, p.users * 1.4)}
                stroke="var(--mx-accent)"
                strokeOpacity={0.35}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ) : null
          )}

        {points.map((p, i) =>
          i % labelEvery === 0 || i === lastIdx ? (
            <g key={p.label} fontFamily="var(--mx-mono)" textAnchor="middle">
              <text
                x={xAt(i)}
                y={y0 + 22}
                fontSize={10.5}
                fontWeight={i === lastIdx ? 600 : 400}
                fill={i === lastIdx ? "var(--mx-fg-soft)" : "var(--mx-muted-soft)"}
              >
                {p.label}
              </text>
              {mode === "week" && (
                <text x={xAt(i)} y={y0 + 34} fontSize={9} fill="var(--mx-muted-soft)">
                  {p.users} altas
                </text>
              )}
            </g>
          ) : null
        )}
        {mode === "day" && (
          <text
            x={(x0 + x1) / 2}
            y={y0 + 39}
            textAnchor="middle"
            fontSize={9.5}
            letterSpacing="0.08em"
            fontFamily="var(--mx-mono)"
            fill="var(--mx-muted-soft)"
          >
            DÍA DE ALTA · MARCA DEL EJE = ALTAS ESE DÍA · SIN MARCA = SIN ALTAS
          </text>
        )}

        {[...series].reverse().map(({ m, runs }) => {
          const primary = m.key === "d1";
          return (
            <g key={m.key}>
              {runs.map((run, ri) =>
                run.length > 1 ? (
                  <path
                    key={ri}
                    d={smoothPath(run)}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={primary ? 2.75 : 1.75}
                    strokeLinecap="round"
                    opacity={primary ? 1 : 0.85}
                    filter={primary ? "url(#mx-rt-glow)" : undefined}
                  />
                ) : null
              )}
            </g>
          );
        })}
        {hits.map((hit, i) => (
          <circle
            key={i}
            cx={hit.x}
            cy={hit.y}
            r={hit.r}
            fill={hit.color}
            stroke="var(--mx-bg-1)"
            strokeWidth={1.5}
          />
        ))}

        <text
          x={live.x}
          y={live.y - live.r - 8}
          textAnchor="middle"
          fontSize={9.5}
          fontWeight={600}
          letterSpacing="0.04em"
          fontFamily="var(--mx-mono)"
          fill="var(--mx-accent)"
        >
          EN CURSO
        </text>
        <circle className="mx-rt-pulse" cx={live.x} cy={live.y} r={live.r} fill="none" stroke="var(--mx-accent)" strokeWidth={1.5} />
        {!liveD1 && <circle cx={live.x} cy={live.y} r={live.r} fill="var(--mx-accent)" stroke="var(--mx-bg-1)" strokeWidth={2} />}

        {hits.map((hit, i) => (
          <circle
            key={`hit-${i}`}
            cx={hit.x}
            cy={hit.y}
            r={hit.r + 7}
            fill="transparent"
            onMouseEnter={() => setHover(hit)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          />
        ))}
        {hover && (
          <circle cx={hover.x} cy={hover.y} r={hover.r + 3.5} fill="none" stroke={hover.color} strokeWidth={1.5} pointerEvents="none" />
        )}
        {tip && hover && (
          <g pointerEvents="none">
            <rect x={tip.x} y={tip.y} width={tip.w} height={36} rx={6} fill="var(--mx-bg-3)" stroke={hover.color} strokeOpacity={0.55} />
            <text x={tip.x + 9} y={tip.y + 14} fontSize={10.5} fontFamily="var(--mx-mono)" fill={hover.color} fontWeight={600}>
              {tip.l1}
            </text>
            <text x={tip.x + 9} y={tip.y + 28} fontSize={10.5} fontFamily="var(--mx-mono)" fill="var(--mx-fg)">
              {tip.l2}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
