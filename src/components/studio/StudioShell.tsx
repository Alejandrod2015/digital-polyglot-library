"use client";

import { useEffect, useState } from "react";
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
    label: "",
    items: [
      { href: "/studio", label: "Resumen", icon: "grid", exact: true },
    ],
  },
  {
    label: "CONTENIDO",
    items: [
      { href: "/studio/monitor", label: "Journey Manager", icon: "pen", exact: false },
      { href: "/studio/journey-stories", label: "Biblioteca", icon: "book", exact: false },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { href: "/studio/planning", label: "Temas, Idiomas y Niveles", icon: "grid", exact: false },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { href: "/studio/config", label: "Reglas pedagógicas", icon: "sliders", exact: false },
      { href: "/studio/settings", label: "Settings", icon: "settings", exact: false },
    ],
  },
];

/* ── Hidden pages (all routes still work, just not in sidebar) ──
  /studio              → Resumen
  /studio/metrics      → Métricas
  /studio/qa           → QA
  /studio/planner      → Planner
  /studio/content      → Content Agent
  /studio/drafts       → Borradores
  /studio/journey-builder → Creador de Journeys
  /studio/sanity       → Sanity CMS
  /studio/team         → Equipo
  /studio/directive    → Directriz
*/

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
    case "users":
      return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "compass":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>;
    case "pen":
      return <svg {...props}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>;
    case "globe":
      return <svg {...props}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
    case "file-text":
      return <svg {...props}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>;
    case "sliders":
      return <svg {...props}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>;
    case "settings":
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
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
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    fetch("/api/studio/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.testMode) setTestMode(true); })
      .catch(() => {});
  }, []);

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
            pendingLabel="Abriendo..."
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
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label || `s${si}`} style={{ padding: "0 12px", marginBottom: 8 }}>
              {section.label && (
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
              )}
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <StudioActionLink
                    key={item.href}
                    href={item.href}
                    pendingLabel={`Abriendo ${item.label.toLowerCase()}...`}
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
        {/* Test mode banner */}
        {testMode && (
          <div style={{
            padding: "6px 32px",
            backgroundColor: "rgba(234, 179, 8, 0.12)",
            borderBottom: "1px solid rgba(234, 179, 8, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#eab308" }}>
              ⚠ Modo de prueba
            </span>
            <span style={{ fontSize: 11, color: "rgba(234, 179, 8, 0.7)" }}>
              Genera historias muy cortas (~50 palabras, 3-5 vocab) para probar el sistema sin gastar tokens
            </span>
          </div>
        )}

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
                      pendingLabel="Abriendo..."
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

