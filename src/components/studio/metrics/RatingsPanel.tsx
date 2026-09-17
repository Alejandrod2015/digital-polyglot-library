"use client";

import { KpiCard, fmt } from "./MetricsPrimitives";
import type { DashboardData } from "./types";

/**
 * Pulgares y comentarios de la fila de valorar, dentro de Engagement.
 *
 * El calculo vive en `@/lib/metricsRatings`: aqui solo se pinta. Lo de casa
 * ya viene quitado, y la conversion ya viene contada sobre preguntas y no
 * sobre impresiones sueltas.
 */

const SURFACE_LABEL: Record<string, string> = {
  story: "Historia",
  practice: "Práctica",
};

const cell = { padding: "6px 8px" } as const;
const muted = { color: "var(--mx-muted)" } as const;

function Vote({ liked }: { liked: boolean }) {
  return (
    <span style={{ color: liked ? "var(--mx-pos)" : "var(--mx-neg)", fontWeight: 600 }}>
      {liked ? "arriba" : "abajo"}
    </span>
  );
}

function pct(a: number, b: number): string {
  return b === 0 ? "-" : `${Math.round((a / b) * 100)}%`;
}

export function RatingsPanel({ ratings }: { ratings: DashboardData["ratings"] }) {
  if (!ratings) return null;

  const asked = ratings.bySurface.reduce((n, s) => n + s.asked, 0);
  const answered = ratings.bySurface.reduce((n, s) => n + s.answered, 0);
  const total = ratings.up + ratings.down;

  return (
    <div className="mx-panel">
      <div className="mx-panel__head">
        <div>
          <div className="mx-panel__eyebrow">Valoraciones</div>
          <h3 className="mx-panel__title">Pulgares y comentarios</h3>
        </div>
        <span className="mx-panel__hint">
          sin el equipo
          {ratings.excludedInternalVotes > 0
            ? ` · ${fmt(ratings.excludedInternalVotes)} votos de casa excluidos`
            : ""}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <KpiCard
          label="Arriba"
          value={ratings.up}
          accent="xp"
          hint={`${fmt(ratings.voters)} ${ratings.voters === 1 ? "persona" : "personas"} han votado`}
        />
        <KpiCard label="Abajo" value={ratings.down} accent="gold" />
        <KpiCard
          label="Comentarios"
          value={ratings.comments}
          accent="gems"
          hint={`sobre ${fmt(total)} ${total === 1 ? "voto" : "votos"}`}
        />
        <KpiCard
          label="Preguntas contestadas"
          value={pct(answered, asked)}
          accent="cyan"
          hint={`${fmt(answered)} de ${fmt(asked)}`}
        />
      </div>

      <div className="mx-panel__sub">Por persona</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.6 }}>
              <th style={cell}>Quién</th>
              <th style={cell}>Sistema</th>
              <th style={{ ...cell, textAlign: "right" }}>Historia</th>
              <th style={{ ...cell, textAlign: "right" }}>Práctica</th>
              <th style={{ ...cell, textAlign: "right" }}>Arriba</th>
              <th style={{ ...cell, textAlign: "right" }}>Abajo</th>
              <th style={{ ...cell, textAlign: "right" }}>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {(ratings.byPerson ?? []).map((u) => (
              <tr key={u.userId} style={{ borderTop: "1px solid var(--mx-border-soft)" }}>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  {u.email ?? (
                    <span style={{ color: "var(--mx-warn)" }} title="Sin correo: no se puede descartar que sea una cuenta de casa">
                      sin correo · {u.userId.slice(-6)}
                    </span>
                  )}
                </td>
                <td style={{ ...cell, ...muted }}>{u.platforms.join(", ") || "-"}</td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                  {u.story.asked} <span style={muted}>→</span> {u.story.answered}
                </td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                  {u.practice.asked} <span style={muted}>→</span> {u.practice.answered}
                </td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(u.up)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(u.down)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(u.comments)}</td>
              </tr>
            ))}
            {(ratings.byPerson ?? []).length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...cell, ...muted, textAlign: "center", padding: 18 }}>
                  Nadie de fuera ha visto la fila de valorar en el rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, ...muted, margin: "6px 0 0" }}>
        preguntas → contestadas. Una pregunta es persona, historia y superficie: el mismo panel
        visto cinco veces cuenta una.
      </p>

      <div className="mx-panel__sub">Por superficie</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.6 }}>
              <th style={cell}>Superficie</th>
              <th style={{ ...cell, textAlign: "right" }}>Preguntas</th>
              <th style={{ ...cell, textAlign: "right" }}>Contestadas</th>
              <th style={{ ...cell, textAlign: "right" }}>Conversión</th>
              <th style={{ ...cell, textAlign: "right" }}>Arriba</th>
              <th style={{ ...cell, textAlign: "right" }}>Abajo</th>
            </tr>
          </thead>
          <tbody>
            {ratings.bySurface.map((s) => (
              <tr key={s.surface} style={{ borderTop: "1px solid var(--mx-border-soft)" }}>
                <td style={cell}>{SURFACE_LABEL[s.surface] ?? s.surface}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(s.asked)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(s.answered)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{pct(s.answered, s.asked)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(s.up)}</td>
                <td style={{ ...cell, textAlign: "right" }}>{fmt(s.down)}</td>
              </tr>
            ))}
            {ratings.bySurface.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...cell, ...muted, textAlign: "center", padding: 18 }}>
                  Nadie ha visto la fila de valorar en el rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {ratings.votesWithoutView > 0 && (
        <p style={{ fontSize: 12, ...muted, margin: "8px 0 0" }}>
          {fmt(ratings.votesWithoutView)}{" "}
          {ratings.votesWithoutView === 1 ? "voto no tiene" : "votos no tienen"} su impresión
          dentro del rango (la vista pudo caer antes de la fecha de inicio). No entran en la
          conversión.
        </p>
      )}

      <div className="mx-panel__sub">Comentarios</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.6 }}>
              <th style={cell}>Fecha</th>
              <th style={cell}>Quién</th>
              <th style={cell}>Historia</th>
              <th style={cell}>Voto</th>
              <th style={cell}>Comentario</th>
            </tr>
          </thead>
          <tbody>
            {ratings.commentRows.map((c) => (
              <tr
                key={`${c.createdAt}-${c.storySlug}-${c.surface}`}
                style={{ borderTop: "1px solid var(--mx-border-soft)", verticalAlign: "top" }}
              >
                <td style={{ ...cell, whiteSpace: "nowrap", ...muted }}>
                  {c.createdAt.slice(0, 10)}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  {c.email ?? "sin correo"}
                  {c.platform ? <span style={muted}> · {c.platform}</span> : null}
                </td>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>
                  <span className="mx-table__slug">{c.storySlug}</span>
                  <span style={muted}> · {SURFACE_LABEL[c.surface] ?? c.surface}</span>
                </td>
                <td style={cell}>
                  <Vote liked={c.liked} />
                </td>
                <td style={{ ...cell, minWidth: 260 }}>{c.comment}</td>
              </tr>
            ))}
            {ratings.commentRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...cell, ...muted, textAlign: "center", padding: 18 }}>
                  Ningún comentario en el rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mx-panel__sub">Por historia</div>
      <div style={{ overflowX: "auto" }}>
        <table className="mx-table">
          <thead>
            <tr>
              <th>Historia</th>
              <th style={{ width: 110 }}>Superficie</th>
              <th style={{ width: 80, textAlign: "right" }}>Arriba</th>
              <th style={{ width: 80, textAlign: "right" }}>Abajo</th>
              <th style={{ width: 110, textAlign: "right" }}>Comentarios</th>
              <th style={{ width: 110, textAlign: "right" }}>Último voto</th>
            </tr>
          </thead>
          <tbody>
            {ratings.byStory.map((r) => (
              <tr key={`${r.storySlug}-${r.surface}`}>
                <td className="mx-table__slug">{r.storySlug}</td>
                <td>{SURFACE_LABEL[r.surface] ?? r.surface}</td>
                <td className="mx-table__num">{fmt(r.up)}</td>
                <td className="mx-table__num">{fmt(r.down)}</td>
                <td className="mx-table__num">{fmt(r.comments)}</td>
                <td className="mx-table__num">{r.lastAt.slice(0, 10)}</td>
              </tr>
            ))}
            {ratings.byStory.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, ...muted, textAlign: "center" }}>
                  Sin votos en el rango seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
