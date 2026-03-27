"use client";

import { usePathname } from "next/navigation";
import StudioActionLink from "@/components/studio/StudioActionLink";

type StudioShellProps = {
  children: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
};

/* ── Sidebar sections ── */
const NAV_SECTIONS = [
  {
    label: "GENERAL",
    items: [
      { href: "/studio", label: "Overview", icon: "grid", exact: true },
      { href: "/studio/metrics", label: "Metrics", icon: "chart", exact: false },
      { href: "/studio/qa", label: "QA", icon: "shield", exact: false },
    ],
  },
  {
    label: "CONTENT",
    items: [
      { href: "/studio/journey-stories", label: "Journey Stories", icon: "book", exact: false },
      { href: "/studio/journey-builder", label: "Journey Builder", icon: "layers", exact: false },
    ],
  },
  {
    label: "LEGACY",
    items: [
      { href: "/studio/sanity", label: "Sanity CMS", icon: "database", exact: false },
    ],
  },
];

/* ── Colors ── */
const ACCENT = "#14b8a6";
const ACCENT_SOFT = "rgba(20, 184, 166, 0.15)";
const SIDEBAR_BG = "#080f1a";
const SIDEBAR_BORDER = "rgba(255, 255, 255, 0.08)";

function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "grid":
      return <svg {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
    case "chart":
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case "shield":
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "book":
      return <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
    case "layers":
      return <svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>;
    case "database":
      return <svg {...props}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>;
    default:
      return null;
  }
}

export default function StudioShell({
  children,
  title,
  description,
  breadcrumbs,
}: StudioShellProps) {
  const pathname = usePathname() ?? "";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      {/* ── Sidebar ── */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 240,
          background: SIDEBAR_BG,
          borderRight: `1px solid ${SIDEBAR_BORDER}`,
          display: "flex",
          flexDirection: "column",
          zIndex: 40,
          overflowY: "auto",
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: "20px 20px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          }}
        >
          <StudioActionLink
            href="/studio"
            pendingLabel="Opening..."
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0 }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: ACCENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
              Digital Polyglot
            </span>
          </StudioActionLink>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: ACCENT,
              background: ACCENT_SOFT,
              padding: "2px 6px",
              borderRadius: 4,
              marginLeft: "auto",
            }}
          >
            STUDIO
          </span>
        </div>

        {/* Nav sections */}
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} style={{ padding: "0 12px", marginBottom: 8 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  padding: "12px 8px 6px",
                  opacity: 0.7,
                }}
              >
                {section.label}
              </span>
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <StudioActionLink
                    key={item.href}
                    href={item.href}
                    pendingLabel={`Opening ${item.label}...`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                      color: active ? ACCENT : "var(--muted)",
                      backgroundColor: active ? ACCENT_SOFT : "transparent",
                      border: "none",
                      textAlign: "left",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </StudioActionLink>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div style={{ marginLeft: 240, flex: 1, minWidth: 0 }}>
        {/* Page header */}
        <header
          style={{
            padding: "24px 32px 20px",
            borderBottom: "1px solid var(--card-border)",
          }}
        >
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && <span style={{ color: "var(--muted)", opacity: 0.5, margin: "0 2px" }}>/</span>}
                  {crumb.href ? (
                    <StudioActionLink
                      href={crumb.href}
                      pendingLabel="Opening..."
                      style={{ fontSize: 13, color: ACCENT, background: "none", border: "none", padding: 0, fontWeight: 500 }}
                    >
                      {crumb.label}
                    </StudioActionLink>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
            {title}
          </h1>
          {description && (
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 4, marginBottom: 0 }}>
              {description}
            </p>
          )}
        </header>

        {/* Content */}
        <main style={{ padding: "24px 32px 48px", maxWidth: 1200 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
