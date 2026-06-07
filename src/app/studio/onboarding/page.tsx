import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import { statusColor, statusLabel, pieceWeight } from "@/lib/assetRoadmap";
import {
  ONBOARDING_PLAN,
  confidenceColor,
  type Priority,
  type FlowStep,
  type EmailRow,
  type PlanPhase,
} from "@/lib/onboardingPlan";

const ACCENT = "#14b8a6";
const ACCENT_SOFT = "rgba(20, 184, 166, 0.12)";
const CARD_BG = "rgba(255, 255, 255, 0.02)";
const CARD_BORDER = "rgba(255, 255, 255, 0.08)";
const TEXT_MUTED = "var(--muted)";

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
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
      {right}
    </div>
  );
}

function ConfidenceBadge({ c }: { c: Priority["confidence"] }) {
  const { bg, fg } = confidenceColor(c);
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: fg,
        background: bg,
        padding: "2px 7px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {c}
    </span>
  );
}

function PriorityCard({ p }: { p: Priority }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: ACCENT,
          background: ACCENT_SOFT,
          width: 26,
          height: 26,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {p.rank}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>{p.title}</h3>
          <span style={{ marginLeft: "auto" }}>
            <ConfidenceBadge c={p.confidence} />
          </span>
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0, lineHeight: 1.55, opacity: 0.9 }}>{p.detail}</p>
      </div>
    </div>
  );
}

function FlowRow({ step, last }: { step: FlowStep; last: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: step.signup ? "#10b981" : ACCENT,
            background: step.signup ? "rgba(16, 185, 129, 0.18)" : ACCENT_SOFT,
            width: 24,
            height: 24,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {step.n}
        </span>
        {!last && <span style={{ flex: 1, width: 2, background: CARD_BORDER, marginTop: 2 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>{step.title}</h3>
          {step.signup && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.14)",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              SIGNUP AQUÍ
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "3px 0 0", lineHeight: 1.5, opacity: 0.9 }}>{step.detail}</p>
      </div>
    </div>
  );
}

const EMAIL_KIND_COLOR: Record<EmailRow["kind"], string> = {
  welcome: "#14b8a6",
  activation: "#f59e0b",
  celebration: "#10b981",
  educational: "#60a5fa",
  recap: "#a78bfa",
  winback: "#fb7185",
};

function EmailRowItem({ row }: { row: EmailRow }) {
  const color = EMAIL_KIND_COLOR[row.kind];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 0.8fr) minmax(0, 1.6fr) minmax(120px, 0.7fr)",
        gap: 12,
        alignItems: "start",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <span style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.4, fontFamily: "ui-monospace, monospace", opacity: 0.85 }}>
        {row.trigger}
      </span>
      <span style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.45 }}>{row.email}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{row.cta}</span>
    </div>
  );
}

function PhaseCard({ phase }: { phase: PlanPhase }) {
  const { bg, fg } = statusColor(phase.status);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: "12px 16px",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: ACCENT,
          background: ACCENT_SOFT,
          width: 24,
          height: 24,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {phase.id}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>{phase.title}</h3>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              fontWeight: 600,
              color: fg,
              background: bg,
              padding: "2px 7px",
              borderRadius: 4,
              whiteSpace: "nowrap",
            }}
          >
            {statusLabel(phase.status)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0, lineHeight: 1.55, opacity: 0.9 }}>{phase.goal}</p>
      </div>
    </div>
  );
}

export default async function StudioOnboardingPage() {
  await requireStudioUser("/studio/onboarding");

  const plan = ONBOARDING_PLAN;
  const doneWeight =
    plan.phases.reduce((sum, p) => sum + pieceWeight(p.status), 0) / Math.max(plan.phases.length, 1);
  const donePct = Math.round(doneWeight * 100);

  return (
    <StudioShell
      title="Onboarding"
      description="Plan de onboarding y automatización de lifecycle, derivado de la investigación de apps de idiomas (Duolingo, Babbel, Busuu, Memrise + LingQ)."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Onboarding" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* North star */}
        <section
          style={{
            background: "linear-gradient(135deg, rgba(20,184,166,0.10), rgba(20,184,166,0.02))",
            border: `1px solid rgba(20,184,166,0.28)`,
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ACCENT }}>
              North star
            </span>
            <span style={{ fontSize: 10, color: TEXT_MUTED, opacity: 0.6 }}>{plan.lastUpdated}</span>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "6px 0 6px", color: "var(--foreground)", lineHeight: 1.25 }}>
            {plan.northStar}
          </h2>
          <p style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>{plan.northStarNote}</p>
          <p style={{ fontSize: 10.5, color: TEXT_MUTED, margin: "10px 0 0", opacity: 0.7 }}>
            Detalle completo y fuentes citadas en <code>{plan.docRef}</code>
          </p>
        </section>

        {/* Priorities */}
        <section>
          <SectionTitle>Prioridades · ordenadas por ROI</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.priorities.map((p) => (
              <PriorityCard key={p.rank} p={p} />
            ))}
          </div>
        </section>

        {/* Target flow */}
        <section>
          <SectionTitle>Flujo objetivo · producto antes de signup</SectionTitle>
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 10,
              padding: "16px 18px",
            }}
          >
            {plan.targetFlow.map((step, i) => (
              <FlowRow key={step.n} step={step} last={i === plan.targetFlow.length - 1} />
            ))}
          </div>
        </section>

        {/* Email sequence */}
        <section>
          <SectionTitle right={<span style={{ fontSize: 10, color: TEXT_MUTED, opacity: 0.6 }}>1 CTA por email · single opt-in</span>}>
            Secuencia de email / lifecycle
          </SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.emailSequence.map((row, i) => (
              <EmailRowItem key={i} row={row} />
            ))}
          </div>
        </section>

        {/* Implementation phases */}
        <section>
          <SectionTitle
            right={
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
                {donePct}% en producción
              </span>
            }
          >
            Plan de implementación · por fases
          </SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.phases.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </section>

        {/* Benchmarks */}
        <section>
          <SectionTitle>Benchmarks del sector</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {plan.benchmarks.map((b, i) => (
              <div
                key={i}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
                    {b.value}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--foreground)", lineHeight: 1.3 }}>{b.metric}</span>
                </div>
                <p style={{ fontSize: 10.5, color: TEXT_MUTED, margin: "4px 0 0", lineHeight: 1.45, opacity: 0.8 }}>{b.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Caveats (collapsed) */}
        <details
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 10,
            padding: "10px 16px",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: TEXT_MUTED,
            }}
          >
            Caveats · qué NO está medido y qué no usar ▾
          </summary>
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
            {plan.caveats.map((c, i) => (
              <li key={i} style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.55 }}>
                {c}
              </li>
            ))}
          </ul>
        </details>

        {/* Sources (collapsed) */}
        <details
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 10,
            padding: "10px 16px",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: TEXT_MUTED,
            }}
          >
            Fuentes principales ▾
          </summary>
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {plan.sources.map((s, i) => (
              <li key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none" }}>
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </StudioShell>
  );
}
