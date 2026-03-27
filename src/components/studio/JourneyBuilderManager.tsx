"use client";

import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";
import StudioActionLink from "@/components/studio/StudioActionLink";

type Props = { plans: JourneyVariantPlan[] };

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#ec4899", "#0ea5e9"];

export default function JourneyBuilderManager({ plans }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Info */}
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 10,
          backgroundColor: "rgba(124, 58, 237, 0.08)",
          border: "1px solid rgba(124, 58, 237, 0.2)",
        }}
      >
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
          Edit the structure of each Journey track here.
        </p>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
          Runtime uses published plans with the old hardcoded curriculum as fallback.
        </p>
      </div>

      {/* Plan cards */}
      {plans.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#128736;&#65039;</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>No Journey plans yet</p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Journey plans will appear here once created via the API or Sanity.</p>
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {plans.map((plan, i) => {
          const color = COLORS[i % COLORS.length];
          const totalTopics = plan.levels.reduce((s, l) => s + l.topics.length, 0);
          return (
            <div
              key={`${plan.language}:${plan.variantId}`}
              className="studio-card"
              style={{
                borderRadius: 12,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                overflow: "hidden",
              }}
            >
              {/* Color top bar */}
              <div style={{ height: 4, backgroundColor: color }} />

              <div style={{ padding: 20 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                      {plan.language}
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
                      {plan.variantId.toUpperCase()} — {plan.levels.length} levels, {totalTopics} topics
                    </p>
                  </div>
                </div>

                {/* Levels */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
                  {plan.levels.map((level) => (
                    <div
                      key={level.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: 8,
                        backgroundColor: "var(--background)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 32,
                            height: 22,
                            borderRadius: 4,
                            backgroundColor: `${color}20`,
                            color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {level.id.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--foreground)" }}>{level.title}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{level.topics.length} topics</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <StudioActionLink
                  href={`/studio/journey-builder/${encodeURIComponent(plan.language)}/${encodeURIComponent(plan.variantId)}`}
                  pendingLabel="Opening builder..."
                  className="studio-btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: color,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 16,
                    border: "none",
                  }}
                >
                  Edit structure
                </StudioActionLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
