"use client";

/**
 * La serie de una tarjeta de KPI, en grande y recorrible con el cursor.
 *
 * El sparkline de la tarjeta dice la FORMA y nada más: se ve que hubo un pico
 * y no se puede saber qué día fue ni cuánto midió. Esta tarjeta pone la misma
 * serie a tamaño legible, con eje y con una cruz que sigue al cursor diciendo
 * el día y el valor de ese punto.
 *
 * Dos diferencias con `PeopleHoverCard`, y las dos son a propósito:
 *
 * 1. Va ANCLADA a la tarjeta, no pegada al cursor. Un gráfico que se mueve
 *    mientras intentas apuntar a un punto no se puede apuntar.
 * 2. Acepta el puntero (`pointerEvents: "auto"`). Hay que poder meter el
 *    cursor dentro para leer las etiquetas, así que quien la abre mantiene el
 *    hover mientras el ratón esté encima de ella.
 *
 * Cuando la cifra además está hecha de personas (DAU, WAU), la lista va debajo
 * del gráfico en esta misma tarjeta, para no tener dos globos peleándose por
 * el mismo hover.
 */
import { useState } from "react";
import type { MetricsKpiUser } from "./types";
import {
  activityLabel,
  kpiUserLabel,
  kpiUserLabelIsPlaceholder,
  sinceLabel,
} from "./PeopleHoverCard";

/** Cuántos nombres caben debajo del gráfico sin que la tarjeta sea una lista. */
const NAME_LIMIT = 6;

const W = 316;
const H = 104;
const PAD = { top: 10, right: 10, bottom: 18, left: 30 };

/** "2026-09-23" -> "23/09". Cualquier otra cosa se devuelve tal cual. */
function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

/** Sin decimales cuando no hacen falta; uno cuando la serie es de razones. */
function fmtValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace(".", ",");
}

export function SparkHoverCard({
  anchor,
  title,
  color,
  values,
  dates,
  suffix,
  serieLabel,
  people,
  onEnter,
  onLeave,
}: {
  /** Rectángulo de la tarjeta que la abre, en coordenadas de ventana. */
  anchor: DOMRect;
  title: string;
  color: string;
  values: number[];
  /** Un día por valor. Cuando falta, el eje se queda sin fechas. */
  dates?: string[];
  suffix?: string;
  /** Qué mide la curva, cuando no es la cifra de la tarjeta. */
  serieLabel?: string;
  people?: MetricsKpiUser[];
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [i, setI] = useState<number | null>(null);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = innerW / (values.length - 1 || 1);
  const xOf = (idx: number) => PAD.left + idx * stepX;
  const yOf = (v: number) => PAD.top + innerH - ((v - min) / range) * innerH;

  const line = values
    .map((v, idx) => `${idx === 0 ? "M" : "L"}${xOf(idx)},${yOf(v)}`)
    .join(" ");
  const area = `${line} L${xOf(values.length - 1)},${PAD.top + innerH} L${PAD.left},${
    PAD.top + innerH
  } Z`;

  // Alto real: el gráfico, la cabecera y, si las hay, las filas de personas.
  const peopleRows = people ? Math.min(people.length, NAME_LIMIT) : 0;
  const estH = 58 + H + peopleRows * 18 + (people && people.length ? 18 : 0);

  const left = Math.min(
    Math.max(8, anchor.left),
    Math.max(8, window.innerWidth - W - 26)
  );
  // Debajo de la tarjeta si cabe; si no, encima.
  const below = anchor.bottom + 8;
  const top = below + estH < window.innerHeight ? below : Math.max(8, anchor.top - estH - 8);

  const picked = i !== null && i >= 0 && i < values.length ? i : null;

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 60,
        width: W + 22,
        pointerEvents: "auto",
        padding: "9px 11px 11px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.45,
        color: "var(--mx-fg)",
        background: "var(--mx-bg-3)",
        border: "1px solid var(--mx-border, rgba(255,255,255,0.16))",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      {/*
        La cabecera es de UNA linea y de alto fijo a proposito.
        Antes el hueco de la derecha decia "pasa el cursor por la curva"
        mientras no hubiera punto elegido, y al elegir uno se quedaba en
        "31/08 - 67%": el titulo dejaba de necesitar dos lineas, pasaba a una,
        y la curva entera daba un salto hacia arriba. Un grafico que se mueve
        cuando lo apuntas no se puede apuntar. Ahora el titulo se recorta con
        puntos suspensivos, la lectura tiene ancho reservado, y el alto no
        depende de si hay punto o no.
      */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          height: 16,
        }}
      >
        <span
          style={{
            opacity: 0.6,
            fontSize: 11,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
          {serieLabel ? (
            <span style={{ opacity: 0.75 }}> {"\u00b7"} {serieLabel}</span>
          ) : null}
        </span>
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 11.5,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            minWidth: 74,
            textAlign: "right",
            // El hueco existe siempre; sin punto elegido se queda en blanco en
            // vez de meter una frase que cambia el ancho de la fila.
            visibility: picked === null ? "hidden" : "visible",
          }}
        >
          {picked === null
            ? "00/00 · 0"
            : `${dates?.[picked] ? shortDate(dates[picked]) + " · " : ""}${fmtValue(
                values[picked]
              )}${suffix === "%" ? "%" : suffix ? " " + suffix : ""}`}
        </span>
      </div>

      <svg
        width={W}
        height={H}
        style={{ display: "block", marginTop: 4, cursor: "crosshair" }}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - box.left - PAD.left;
          setI(Math.max(0, Math.min(values.length - 1, Math.round(x / stepX))));
        }}
        onMouseLeave={() => setI(null)}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + innerH}
          y2={PAD.top + innerH}
          stroke="var(--mx-border, rgba(255,255,255,0.16))"
        />
        <text x={2} y={PAD.top + 4} fontSize={9.5} fill="var(--mx-muted, #8a8a8a)">
          {fmtValue(max)}
        </text>
        <text
          x={2}
          y={PAD.top + innerH + 3}
          fontSize={9.5}
          fill="var(--mx-muted, #8a8a8a)"
        >
          {fmtValue(min)}
        </text>
        {dates && dates.length > 0 ? (
          <>
            <text
              x={PAD.left}
              y={H - 5}
              fontSize={9.5}
              fill="var(--mx-muted, #8a8a8a)"
            >
              {shortDate(dates[0])}
            </text>
            <text
              x={W - PAD.right}
              y={H - 5}
              fontSize={9.5}
              textAnchor="end"
              fill="var(--mx-muted, #8a8a8a)"
            >
              {shortDate(dates[dates.length - 1])}
            </text>
          </>
        ) : null}
        <path d={area} fill={color} opacity={0.14} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.6} />
        {picked !== null ? (
          <>
            <line
              x1={xOf(picked)}
              x2={xOf(picked)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke={color}
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={xOf(picked)}
              cy={yOf(values[picked])}
              r={3}
              fill={color}
              stroke="var(--mx-bg-3)"
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </svg>

      {people ? (
        people.length === 0 ? (
          <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.6 }}>
            Nadie en esta ventana.
          </div>
        ) : (
          <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
            {people.slice(0, NAME_LIMIT).map((u) => (
              <li
                key={u.userId}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    ...(kpiUserLabelIsPlaceholder(u)
                      ? { opacity: 0.55, fontStyle: "italic" as const }
                      : null),
                  }}
                >
                  {kpiUserLabel(u)}
                </span>
                <span
                  style={{
                    opacity: 0.75,
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {activityLabel(u)} · {sinceLabel(u.lastAt)}
                </span>
              </li>
            ))}
            {people.length > NAME_LIMIT ? (
              <li style={{ fontSize: 11.5, opacity: 0.6 }}>
                y {people.length - NAME_LIMIT} más
              </li>
            ) : null}
          </ul>
        )
      ) : null}
    </div>
  );
}
