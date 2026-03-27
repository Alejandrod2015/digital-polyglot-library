import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";

const CARDS = [
  {
    title: "Journey Stories",
    desc: "Create, edit, and manage the stories that feed Journey.",
    href: "/studio/journey-stories",
    icon: "📖",
  },
  {
    title: "Journey Builder",
    desc: "Edit the structure: variants, levels, topics, story slots.",
    href: "/studio/journey-builder",
    icon: "🧩",
  },
  {
    title: "Metrics",
    desc: "Usage funnels, reminders, top stories, book performance.",
    href: "/studio/metrics",
    icon: "📊",
  },
  {
    title: "QA",
    desc: "Audit the app for bugs, inconsistencies, and UX problems.",
    href: "/studio/qa",
    icon: "🛡️",
  },
  {
    title: "Legacy CMS (Sanity)",
    desc: "Open the existing Sanity Studio for legacy editing.",
    href: "/studio/sanity",
    icon: "🗄️",
  },
];

export default async function StudioOverviewPage() {
  await requireStudioUser("/studio");

  return (
    <StudioShell title="Overview" description="Manage Journey content and structure from one place.">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Info box */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 10,
            backgroundColor: "var(--studio-accent-soft)",
            border: "1px solid rgba(20, 184, 166, 0.25)",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
            Studio is running in hybrid mode
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
            Use Studio for new Journey work. Sanity stays available in parallel until this workflow is stable.
          </p>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {CARDS.map((card) => (
            <StudioActionLink
              key={card.title}
              href={card.href}
              pendingLabel={`Opening ${card.title}...`}
              className="studio-card"
              style={{
                display: "block",
                padding: 20,
                borderRadius: 12,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1, display: "block", marginBottom: 12 }}>
                {card.icon}
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                {card.title}
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
                {card.desc}
              </p>
            </StudioActionLink>
          ))}
        </div>

        {/* Status row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Mode", value: "Hybrid", detail: "Studio + Sanity in parallel", color: "#14b8a6" },
            { label: "Backend", value: "Sanity", detail: "Storage & editorial layer", color: "#f59e0b" },
            { label: "Runtime", value: "Fallback active", detail: "Sanity → hardcoded curriculum", color: "#3b82f6" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", margin: 0 }}>
                {item.label}
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: item.color, margin: "4px 0 0" }}>
                {item.value}
              </p>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </StudioShell>
  );
}
