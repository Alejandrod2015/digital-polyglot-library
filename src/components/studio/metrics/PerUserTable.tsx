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

function nombre(u: MetricsPerUserRow): string {
  return u.name || u.email || u.userId.slice(-8);
}

/** La variación, ya redondeada. Sin cambio devuelve null y no se pinta nada. */
function delta(actual: number, anterior: number, decimales: number): string | null {
  const d = Math.round((actual - anterior) * 10 ** decimales) / 10 ** decimales;
  if (d === 0) return null;
  return d > 0 ? `+${d}` : String(d);
}

export function PerUserTable({ rows, days }: { rows: MetricsPerUserRow[]; days: number }) {
  const [orden, setOrden] = useState<Columna>("minutes");
  const ordenadas = [...rows].sort((a, b) => b[orden] - a[orden] || b.minutes - a.minutes);

  return (
    <div className="mx-panel">
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Por persona</div>
          <h3 className="mx-panel__title">Quién va a más y quién a menos</h3>
        </div>
        <span className="mx-panel__hint">
          {rows.length} {rows.length === 1 ? "persona activa" : "personas activas"} · variación contra los {days} días anteriores
        </span>
      </div>

      {rows.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>Nadie con actividad en el rango.</p>
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
