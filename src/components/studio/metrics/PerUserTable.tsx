"use client";

/**
 * Tabla por persona, con el periodo anterior al lado.
 *
 * El panel estaba lleno de medias, y una media sube igual porque entre dos
 * personas nuevas o porque una vieja se enganchó. Aquí cada fila es alguien, y
 * cada cifra lleva su variación contra el periodo anterior (los mismos días,
 * justo antes), que es lo único que responde a "¿va a más o a menos?".
 */
import { useState } from "react";
import type { MetricsPerUserRow } from "./types";

type Columna = "minutes" | "activeDays" | "storiesFinished" | "practices";

const COLUMNAS: Array<{ key: Columna; label: string; prev: keyof MetricsPerUserRow; decimales: number }> = [
  { key: "minutes", label: "Minutos", prev: "prevMinutes", decimales: 1 },
  { key: "activeDays", label: "Días activos", prev: "prevActiveDays", decimales: 0 },
  { key: "storiesFinished", label: "Terminadas", prev: "prevStoriesFinished", decimales: 0 },
  { key: "practices", label: "Prácticas", prev: "prevPractices", decimales: 0 },
];

/**
 * Nunca un trozo de id: se lee como si fuera el nombre de alguien. Mismo
 * criterio que `kpiUserLabel` en la tarjeta del DAU, y por el mismo caso
 * (2026-09-16, dos cuentas borradas con filas de metricas vivas).
 */
function nombre(u: MetricsPerUserRow): string {
  return u.name || u.email || "Sin identificar";
}

/** La variación, ya redondeada. Sin cambio devuelve null y no se pinta nada. */
function delta(actual: number, anterior: number, decimales: number): string | null {
  const d = Math.round((actual - anterior) * 10 ** decimales) / 10 ** decimales;
  if (d === 0) return null;
  return d > 0 ? `+${d}` : String(d);
}

type Segmento = "apagados" | "bajaron" | "subieron" | "todos";

/**
 * En que grupo cae una persona comparando el periodo con el anterior.
 *
 * Los minutos mandan porque son lo unico continuo: dias activos e historias
 * terminadas saltan de cero a uno y de uno a cero por un dia de diferencia.
 */
function segmentoDe(u: MetricsPerUserRow): Segmento {
  if (u.minutes === 0 && u.prevMinutes > 0) return "apagados";
  if (u.minutes < u.prevMinutes) return "bajaron";
  if (u.minutes > u.prevMinutes) return "subieron";
  return "todos";
}

export function PerUserTable({ rows, days }: { rows: MetricsPerUserRow[]; days: number }) {
  const [orden, setOrden] = useState<Columna>("minutes");
  // La tabla listaba a todo el mundo, y de 94 filas unas 60 estaban a cero en
  // las cuatro columnas: ordenar por minutos dejaba arriba a quien ya sabias
  // que iba bien y enterraba lo unico que pide accion, que es quien ESTABA y
  // ya no esta. Se entra por ese grupo.
  const [segmento, setSegmento] = useState<Segmento>("apagados");

  const porSegmento = {
    apagados: rows.filter((u) => segmentoDe(u) === "apagados"),
    bajaron: rows.filter((u) => segmentoDe(u) === "bajaron"),
    subieron: rows.filter((u) => segmentoDe(u) === "subieron"),
    todos: rows,
  };
  const visibles = porSegmento[segmento];
  const ordenadas = [...visibles].sort(
    (a, b) => b[orden] - a[orden] || b.minutes - a.minutes
  );

  const CHIPS: Array<{ key: Segmento; label: string }> = [
    { key: "apagados", label: "Se apagaron" },
    { key: "bajaron", label: "Van a menos" },
    { key: "subieron", label: "Van a más" },
    { key: "todos", label: "Todos" },
  ];

  return (
    <div className="mx-panel">
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Por persona</div>
          <h3 className="mx-panel__title">Quién va a más y quién a menos</h3>
        </div>
        <span className="mx-panel__hint">
          contra los {days} días anteriores
        </span>
      </div>

      <div className="mx-segmented" style={{ marginBottom: 12 }}>
        {CHIPS.map((c) => (
          <button
            type="button"
            key={c.key}
            onClick={() => setSegmento(c.key)}
            className={
              segmento === c.key
                ? "mx-segmented__btn mx-segmented__btn--active"
                : "mx-segmented__btn"
            }
          >
            {c.label} {porSegmento[c.key].length}
          </button>
        ))}
      </div>

      {ordenadas.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>
          {segmento === "apagados"
            ? "Nadie que estuviera activo se ha apagado."
            : "Nadie en este grupo."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.6 }}>
                <th style={{ padding: "6px 8px", fontWeight: 600 }}>Persona</th>
                {COLUMNAS.map((c) => (
                  <th key={c.key} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={() => setOrden(c.key)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        font: "inherit",
                        color: orden === c.key ? "var(--mx-fg, #e2e8f0)" : "inherit",
                        opacity: orden === c.key ? 1 : 0.75,
                      }}
                    >
                      {c.label}
                      {orden === c.key ? " ↓" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((u) => (
                <tr key={u.userId} style={{ borderTop: "1px solid var(--mx-border, rgba(255,255,255,0.08))" }}>
                  <td style={{ padding: "6px 8px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {nombre(u)}
                  </td>
                  {COLUMNAS.map((c) => {
                    const actual = u[c.key];
                    const anterior = u[c.prev] as number;
                    const d = delta(actual, anterior, c.decimales);
                    return (
                      <td key={c.key} style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {actual}
                        {d ? (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 11,
                              color: d.startsWith("+") ? "#5ad19a" : "#f08a8a",
                            }}
                          >
                            {d}
                          </span>
                        ) : (
                          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.35 }}>=</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--mx-muted)", lineHeight: 1.5 }}>
        Los minutos son la suma del punto más lejano alcanzado en cada historia, no
        tiempo de reloj. «Terminadas» cuenta historias distintas con `audio_complete`,
        así que volver a oír una no suma. La variación compara con los {days} días
        anteriores al rango: un signo verde es más que entonces, uno rojo es menos, y
        el guion es que no ha cambiado.
      </p>
    </div>
  );
}
