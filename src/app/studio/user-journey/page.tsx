import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import JourneyGallery from "./JourneyGallery";

const CARD_BORDER = "rgba(255, 255, 255, 0.08)";
const TEXT_MUTED = "var(--muted)";

export default async function StudioUserJourneyPage() {
  await requireStudioUser("/studio/user-journey");

  return (
    <StudioShell
      title="User Journey"
      description="El recorrido de un usuario nuevo en la app iOS, de la bienvenida al hábito diario, en 20 pantallas reales (incluido el journey guiado con progreso)."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "User Journey" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section
          style={{
            background: "linear-gradient(135deg, rgba(252,211,77,0.09), rgba(252,211,77,0.02))",
            border: "1px solid rgba(252,211,77,0.26)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg)", maxWidth: "64ch", lineHeight: 1.55, opacity: 0.9 }}>
            Capturas reales de la build iOS contra datos de producción, en orden de recorrido. Toca cualquier pantalla
            para verla en grande con su explicación (← → para navegar).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["20 pantallas", "iOS · producción", "Journey LATAM"].map((chip) => (
              <span
                key={chip}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_MUTED,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 999,
                  padding: "5px 11px",
                  whiteSpace: "nowrap",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        </section>

        <JourneyGallery />

        <p
          style={{
            marginTop: 4,
            padding: "14px 16px",
            border: `1px dashed ${CARD_BORDER}`,
            borderRadius: 12,
            color: TEXT_MUTED,
            fontSize: 12.5,
            lineHeight: 1.6,
          }}
        >
          Recorre el loop completo: journey guiado → abrir historia → guardar palabra → fin de historia → practicar esas palabras (ronda real) → progreso. Explore queda como modo paralelo. Capturado con una sesión de prueba contra la base de datos de producción; solo falta la celebración post-ronda.
        </p>
      </div>
    </StudioShell>
  );
}
