import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import {
  BLACK_FRIDAY_PLAN as P,
  TASK_STATUS_META,
} from "@/lib/blackFridayPlan";

const ACCENT = "#fcd34d"; // gold
const ACCENT_SOFT = "rgba(252, 211, 77, 0.14)";
const CARD_BG = "rgba(255, 255, 255, 0.02)";
const CARD_BORDER = "rgba(255, 255, 255, 0.08)";
const TEXT_MUTED = "var(--muted)";

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 8px" }}>
      <h2
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: TEXT_MUTED,
          margin: 0,
        }}
      >
        {children}
      </h2>
      {hint && <span style={{ fontSize: 10, color: TEXT_MUTED, opacity: 0.6 }}>{hint}</span>}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 10, padding: "14px 16px", ...style }}>
      {children}
    </div>
  );
}

export default async function StudioBlackFridayPage() {
  await requireStudioUser("/studio/black-friday");

  const doneCount = P.buildTasks.filter((t) => t.status === "done").length;

  return (
    <StudioShell
      title="Black Friday 2026"
      description="Plan de campaña · meta: nuevos suscriptores pagos · mercado US"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Black Friday" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* ── Top band: goal + event + offer hero ── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 14 }}>
          {/* Offer hero */}
          <div
            style={{
              border: `1.5px solid ${ACCENT}`,
              borderRadius: 12,
              padding: "16px 18px",
              background: "linear-gradient(180deg, rgba(252,211,77,0.10), rgba(255,255,255,0.01) 70%)",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: ACCENT }}>
              OFERTA RECOMENDADA
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--foreground)", lineHeight: 1.1 }}>
                {P.offer.headline}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                <s style={{ color: TEXT_MUTED, opacity: 0.6, fontWeight: 500 }}>{P.offer.priceStrike}</s>{" "}
                <span style={{ color: ACCENT }}>→ {P.offer.priceNow}</span>
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.6 }}>
              {P.offer.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>

          {/* Meta + PDF download */}
          <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Meta label="Meta" value={P.goal} />
              <Meta label="Mercado" value={P.market} />
              <Meta label="Evento" value={P.eventDate} />
              <Meta label="Última actualización" value={P.lastUpdated} muted />
            </div>
            <a
              href={P.pdfHref}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: ACCENT,
                color: "#2a1a02",
                fontSize: 13,
                fontWeight: 800,
                padding: "9px 14px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar one-pager (PDF)
            </a>
          </Card>
        </div>

        {/* ── Embedded PDF ── */}
        <section>
          <SectionTitle hint="resumen ejecutivo de 1 página">One-pager</SectionTitle>
          <div style={{ border: `1px solid ${CARD_BORDER}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
            <object data={P.pdfHref} type="application/pdf" width="100%" style={{ height: 560, display: "block" }}>
              <div style={{ padding: 24, color: "#1a1a1a", fontSize: 13 }}>
                Tu navegador no puede mostrar el PDF embebido.{" "}
                <a href={P.pdfHref} target="_blank" rel="noreferrer" style={{ color: "#0D1B2A", fontWeight: 700 }}>
                  Ábrelo en una pestaña nueva
                </a>
                .
              </div>
            </object>
          </div>
        </section>

        {/* ── Decisiones clave ── */}
        <section>
          <SectionTitle hint="ordenadas por prioridad">Decisiones clave</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
            {P.decisions.map((d, i) => (
              <Card key={i} style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      background: "#0D1B2A",
                      color: "#fff",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{d.body}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Build tasks (trackable) ── */}
        <section>
          <SectionTitle hint={`${doneCount}/${P.buildTasks.length} hechas · editar estados en src/lib/blackFridayPlan.ts`}>
            Prerrequisitos de ingeniería
          </SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {P.buildTasks.map((t, i) => {
              const s = TASK_STATUS_META[t.status];
              return (
                <Card key={i} style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: ACCENT,
                        background: ACCENT_SOFT,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      P{t.priority}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: TEXT_MUTED, marginTop: 3, lineHeight: 1.5, opacity: 0.9 }}>{t.note}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: s.fg,
                        background: s.bg,
                        padding: "3px 8px",
                        borderRadius: 5,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── Calendar ── */}
        <section>
          <SectionTitle hint="ancla: vie 27 / lun 30 nov 2026">Calendario</SectionTitle>
          <Card style={{ padding: "6px 14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {P.calendar.map((c, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i === P.calendar.length - 1 ? "none" : `1px solid ${CARD_BORDER}`,
                      background: c.peak ? ACCENT_SOFT : "transparent",
                    }}
                  >
                    <td style={{ padding: "8px 8px", fontWeight: 700, color: ACCENT, whiteSpace: "nowrap", width: 92 }}>{c.date}</td>
                    <td style={{ padding: "8px 8px", color: TEXT_MUTED, whiteSpace: "nowrap", width: 96, fontSize: 11 }}>{c.phase}</td>
                    <td style={{ padding: "8px 8px", color: "var(--foreground)" }}>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {/* ── Two-column: channels + page tactics ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          <section>
            <SectionTitle hint="orden de prioridad">Canales</SectionTitle>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {P.channels.map((c) => (
                  <div key={c.rank} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, minWidth: 16 }}>{c.rank}.</span>
                    <div style={{ fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--foreground)" }}>{c.name}</strong>; {c.note}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>Página /plans + checkout</SectionTitle>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.6 }}>
                {P.pageTactics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        {/* ── Two-column: retention + risks ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          <section>
            <SectionTitle>Retención post-descuento</SectionTitle>
            <Card>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: TEXT_MUTED, lineHeight: 1.6 }}>
                {P.retention.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Card>
          </section>

          <section>
            <SectionTitle>Riesgos a vigilar</SectionTitle>
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {P.risks.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: r.kind === "ok" ? "#34d399" : "#f87171",
                        background: r.kind === "ok" ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                        padding: "2px 6px",
                        borderRadius: 4,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {r.kind === "ok" ? "OK" : "RIESGO"}
                    </span>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
                      <strong style={{ color: "var(--foreground)" }}>{r.label}:</strong> {r.body}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>

        {/* ── Footer note ── */}
        <p style={{ fontSize: 11, color: TEXT_MUTED, opacity: 0.7, lineHeight: 1.5, margin: 0 }}>
          {P.confidenceNote} Investigación: 7 ángulos · {P.sourcesCount}+ fuentes · verificación adversarial.
        </p>
      </div>
    </StudioShell>
  );
}

function Meta({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_MUTED, opacity: 0.6 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: muted ? TEXT_MUTED : "var(--foreground)", fontWeight: muted ? 400 : 600 }}>
        {value}
      </span>
    </div>
  );
}
