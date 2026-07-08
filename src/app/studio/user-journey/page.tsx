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
      description="El recorrido de un usuario nuevo en la app iOS, de la bienvenida al hábito diario, en 10 pantallas reales."
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
            {["10 pantallas", "iOS · producción", "Journey LATAM"].map((chip) => (
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
          Las pantallas de Journey y Práctica se muestran en modo invitado (sin sesión). Con sesión iniciada esas mismas
          vistas cambian por el progreso personalizado del usuario. Faltan por capturar los flujos signed-in (home
          personalizado, tour de coachmarks y una ronda de práctica en curso).
        </p>
      </div>
    </StudioShell>
  );
}
