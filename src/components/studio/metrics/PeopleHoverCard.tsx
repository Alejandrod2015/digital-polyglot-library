"use client";

/**
 * Tarjeta que sale al pasar el cursor por una cifra hecha de personas.
 *
 * Un "4" en DAU no dice si son cuatro caras nuevas o las mismas de siempre, y
 * esa es la pregunta que sigue siempre a la cifra cuando hay cuatro. Aquí se
 * responde con nombres, cuántos eventos puso cada uno y cuándo fue el último.
 *
 * Va en `position: fixed` pegada al cursor y con `pointer-events: none`, así
 * que no se puede hacer clic en ella ni tapa lo que hay debajo.
 */
import type { MetricsKpiUser } from "./types";

/** Cuántos nombres caben antes de que la tarjeta estorbe más de lo que ayuda. */
const NAME_LIMIT = 8;

/**
 * Cómo se llama alguien en la tarjeta. Quien entró con código por correo o con
 * Apple escondiendo el nombre no deja `firstName` en Clerk, así que el correo
 * es el segundo mejor identificador y el id, el último recurso.
 */
export function kpiUserLabel(u: MetricsKpiUser): string {
  return u.name || u.email || u.userId.slice(-8);
}

/** "hace 5 min", "hace 3 h", "hace 2 d". Sin fecha, cadena vacía. */
export function sinceLabel(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function PeopleHoverCard({
  x,
  y,
  title,
  headline,
  note,
  people,
}: {
  x: number;
  y: number;
  title: string;
  headline: string;
  note?: string;
  people: MetricsKpiUser[];
}) {
  const shown = people.slice(0, NAME_LIMIT);
  return (
    <div
      style={{
        position: "fixed",
        // Pegada al cursor, pero sin salirse por el borde derecho ni por abajo.
        left: Math.min(x + 16, Math.max(8, window.innerWidth - 320)),
        top: Math.min(y + 16, Math.max(8, window.innerHeight - 300)),
        zIndex: 60,
        width: 300,
        maxHeight: 290,
        overflow: "hidden",
        pointerEvents: "none",
        padding: "9px 11px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.45,
        color: "var(--mx-text, #e2e8f0)",
        background: "var(--mx-panel, #0f172a)",
        border: "1px solid var(--mx-border, rgba(255,255,255,0.16))",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ opacity: 0.6, fontSize: 11 }}>{title}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{headline}</div>
      {note ? (
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>{note}</div>
      ) : null}
      {people.length === 0 ? (
        <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.6 }}>Nadie en esta ventana.</div>
      ) : (
        <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
          {shown.map((u) => (
            <li
              key={u.userId}
              style={{ display: "flex", gap: 8, fontSize: 11.5, lineHeight: 1.5, alignItems: "baseline" }}
            >
              <span
                style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {kpiUserLabel(u)}
              </span>
              <span style={{ opacity: 0.75, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {u.events} ev · {sinceLabel(u.lastAt)}
              </span>
            </li>
          ))}
          {people.length > shown.length ? (
            <li style={{ fontSize: 11.5, opacity: 0.6 }}>y {people.length - shown.length} más</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
