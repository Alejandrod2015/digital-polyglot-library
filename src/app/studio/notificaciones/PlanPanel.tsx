"use client";

import {
  PLAN_CAVEAT,
  PLAN_GROUP_LABEL,
  PLAN_GROUP_ORDER,
  PLAN_COPY_VOICE,
  PLAN_RULES,
  PLAN_STATUS_LABEL,
  SMART_NOTIFICATIONS,
  planCounts,
  type PlanStatus,
  type SmartNotification,
} from "@/lib/smartNotificationPlan";

const ACCENT = "#fcd34d";
const CARD_BG = "#0f1f34";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const INPUT_BG = "#0a1628";

const STATUS_COLOR: Record<PlanStatus, string> = {
  live: "#4ade80",
  ready: ACCENT,
  needsWork: "#94a3b8",
};

function StatusPill({ status }: { status: PlanStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}1a`,
        border: `1px solid ${color}55`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: status === "live" ? `0 0 6px ${color}` : undefined,
        }}
      />
      {PLAN_STATUS_LABEL[status]}
    </span>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: "var(--muted)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

function Icon({ name }: { name: "signal" | "clock" | "target" | "lock" }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "signal") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M3 12h4l3 8 4-16 3 8h4" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// Vista previa del aviso tal y como se ve en la pantalla bloqueada del iPhone.
function BannerPreview({ item }: { item: SmartNotification }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: ACCENT,
          color: "#0a1628",
          fontSize: 13,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        DP
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "var(--foreground)" }}>
          {item.copy.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--foreground)", opacity: 0.78, lineHeight: 1.35 }}>
          {item.copy.body}
        </p>
      </div>
    </div>
  );
}

function Tile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "12px 16px",
        minWidth: 120,
        flex: "1 1 120px",
      }}
    >
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
        {label}
      </p>
    </div>
  );
}

export default function PlanPanel() {
  const counts = planCounts();
  const byPriority = [...SMART_NOTIFICATIONS].sort((a, b) => a.priority - b.priority);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Tile value={counts.live} label="Enviando" color={STATUS_COLOR.live} />
        <Tile value={counts.ready} label="Señal lista" color={STATUS_COLOR.ready} />
        <Tile value={counts.needsWork} label="Falta un dato" color={STATUS_COLOR.needsWork} />
        <Tile value={counts.total} label="Disparadores" color="var(--foreground)" />
      </div>

      <div
        style={{
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.35)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12.5,
          color: "#fca5a5",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: "#f87171" }}>Solo iOS.</strong> {PLAN_CAVEAT.replace("Solo salen a iOS. ", "")}
      </div>

      {PLAN_GROUP_ORDER.map((group) => {
        const items = byPriority.filter((n) => n.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              {PLAN_GROUP_LABEL[group]}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              {items.map((item) => (
                <article
                  key={item.id}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${item.status === "live" ? `${STATUS_COLOR.live}44` : CARD_BORDER}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: item.status === "needsWork" ? 0.82 : 1,
                  }}
                >
                  <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: INPUT_BG,
                        border: `1px solid ${CARD_BORDER}`,
                        color: "var(--muted)",
                        fontSize: 11.5,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}
                      title="Orden de construcción"
                    >
                      {item.priority}
                    </span>
                    <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--foreground)", flex: 1 }}>
                      {item.label}
                    </h4>
                    <StatusPill status={item.status} />
                  </header>

                  <BannerPreview item={item} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    <Meta icon={<Icon name="signal" />}>{item.signal}</Meta>
                    <Meta icon={<Icon name="clock" />}>{item.window}</Meta>
                    <Meta icon={<Icon name="target" />}>{item.destination}</Meta>
                    <Meta icon={<Icon name="lock" />}>
                      Opt-in <code style={{ background: INPUT_BG, padding: "1px 5px", borderRadius: 4 }}>{item.optIn}</code>
                    </Meta>
                  </div>

                  {item.builtIn ? (
                    <p style={{ margin: 0, fontSize: 11.5, color: STATUS_COLOR.live, lineHeight: 1.45 }}>
                      {item.builtIn}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11.5,
                        color: "var(--muted)",
                        lineHeight: 1.5,
                        borderLeft: `2px solid ${CARD_BORDER}`,
                        paddingLeft: 9,
                      }}
                    >
                      {item.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Cómo suena un aviso
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, maxWidth: 760 }}>
          La prueba antes de escribir uno: léelo en voz alta como si lo dijera un amigo que ha leído la
          misma historia. Si suena a que le pasas cuenta al alumno por lo que no hizo, está mal escrito,
          aunque el dato sea correcto.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ background: CARD_BG, border: `1px solid ${STATUS_COLOR.live}33`, borderRadius: 12, overflow: "hidden" }}>
            <p style={{ margin: 0, padding: "8px 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: STATUS_COLOR.live, background: `${STATUS_COLOR.live}12` }}>
              Así sí
            </p>
            {PLAN_COPY_VOICE.map((rule, i) => (
              <p
                key={`keep-${i}`}
                style={{ margin: 0, padding: "9px 14px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, borderTop: i === 0 ? "none" : `1px solid ${CARD_BORDER}` }}
              >
                {rule.keep}
              </p>
            ))}
          </div>
          <div style={{ background: CARD_BG, border: "1px solid rgba(248,113,113,0.28)", borderRadius: 12, overflow: "hidden" }}>
            <p style={{ margin: 0, padding: "8px 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#f87171", background: "rgba(248,113,113,0.08)" }}>
              Así no
            </p>
            {PLAN_COPY_VOICE.map((rule, i) => (
              <p
                key={`avoid-${i}`}
                style={{ margin: 0, padding: "9px 14px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45, borderTop: i === 0 ? "none" : `1px solid ${CARD_BORDER}`, textDecoration: "none" }}
              >
                {rule.avoid}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Reglas que valen para todos
        </h3>
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {PLAN_RULES.map((rule, i) => (
            <div
              key={rule.label}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(90px, 130px) 1fr",
                gap: 14,
                padding: "10px 16px",
                borderTop: i === 0 ? "none" : `1px solid ${CARD_BORDER}`,
                fontSize: 12.5,
              }}
            >
              <span style={{ color: ACCENT, fontWeight: 700 }}>{rule.label}</span>
              <span style={{ color: "var(--muted)", lineHeight: 1.5 }}>{rule.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
