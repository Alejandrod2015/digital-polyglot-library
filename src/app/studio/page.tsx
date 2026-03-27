import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";

const CARDS = [
  {
    title: "Creador de Journeys",
    desc: "Crea journeys nuevos y define su estructura: niveles, topics e historias.",
    href: "/studio/journey-builder",
    icon: "🧩",
  },
  {
    title: "Biblioteca de historias",
    desc: "Consulta y edita historias existentes cuando necesites revisar el inventario completo.",
    href: "/studio/journey-stories",
    icon: "📖",
  },
  {
    title: "Métricas",
    desc: "Uso, recordatorios, historias más fuertes y rendimiento del catálogo.",
    href: "/studio/metrics",
    icon: "📊",
  },
  {
    title: "QA",
    desc: "Audita la app para detectar bugs, inconsistencias y problemas de UX.",
    href: "/studio/qa",
    icon: "🛡️",
  },
  {
    title: "Sanity",
    desc: "Abre el CMS anterior mientras terminamos la transición.",
    href: "/studio/sanity",
    icon: "🗄️",
  },
  {
    title: "Equipo",
    desc: "Gestiona quién tiene acceso al studio y con qué rol.",
    href: "/studio/team",
    icon: "👥",
  },
];

export default async function StudioOverviewPage() {
  await requireStudioUser("/studio");

  return (
    <StudioShell title="Resumen" description="Gestiona el contenido y la estructura del Journey desde un solo lugar.">
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
            Studio está en modo híbrido
          </p>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>
            Usa Studio para todo lo nuevo del Journey. Sanity sigue disponible en paralelo mientras consolidamos este flujo.
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
              pendingLabel={`Abriendo ${card.title.toLowerCase()}...`}
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
            { label: "Modo", value: "Híbrido", detail: "Studio + Sanity en paralelo", color: "#14b8a6" },
            { label: "Backend", value: "Sanity", detail: "Almacenamiento y capa editorial", color: "#f59e0b" },
            { label: "Runtime", value: "Fallback activo", detail: "Sanity -> currículo hardcodeado", color: "#3b82f6" },
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
