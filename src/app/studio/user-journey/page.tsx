import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";

/* Palette aligned with the studio navy + gold system. */
const ACCENT = "#fcd34d";
const ACCENT_SOFT = "rgba(252, 211, 77, 0.14)";
const CARD_BG = "rgba(255, 255, 255, 0.02)";
const CARD_BORDER = "rgba(255, 255, 255, 0.08)";
const TEXT_MUTED = "var(--muted)";
const BEZEL = "#05080d";

type Phase = {
  n: string;
  img: string;
  label: string;
  title: string;
  body: string;
  core?: boolean;
};

type Act = {
  kicker: string;
  title: string;
  intent: string;
  phases: Phase[];
};

const ACTS: Act[] = [
  {
    kicker: "Acto I",
    title: "Llegar y configurar",
    intent: "Del primer toque a un punto de partida claro.",
    phases: [
      {
        n: "01",
        img: "j01",
        label: "Bienvenida",
        title: "La promesa, en la primera pantalla",
        body: "Al abrir la app, el usuario ve la propuesta central y las formas de entrar: Google, Facebook o email. Un solo objetivo en foco: empezar.",
      },
      {
        n: "02",
        img: "j02",
        label: "Onboarding",
        title: "Elige qué quieres aprender",
        body: "Paso 1 de 4. El primer idioma se vuelve el journey inicial; el resto queda listo en el selector. Selección múltiple, cero fricción.",
      },
      {
        n: "03",
        img: "j03",
        label: "Tu journey",
        title: "Un siguiente paso, siempre visible",
        body: "La pestaña Journey propone qué hacer ahora. En modo invitado invita a entrar; con sesión iniciada muestra el camino guiado.",
      },
    ],
  },
  {
    kicker: "Acto II",
    title: "Aprender en contexto",
    intent: "El lenguaje auténtico, dentro de una historia.",
    phases: [
      {
        n: "04",
        img: "j04",
        label: "Explorar",
        title: "Una biblioteca viva",
        body: "80 historias filtrables por tema y nivel, con portadas propias. El usuario elige por interés, no por demografía.",
      },
      {
        n: "05",
        img: "j05",
        label: "Colección",
        title: "Contexto antes de entrar",
        body: "Cada colección muestra nivel, duración media y valoración. Se sabe qué esperar antes de abrir una historia.",
      },
      {
        n: "06",
        img: "j06",
        label: "Historia + audio",
        title: "El corazón del producto",
        core: true,
        body: "Texto auténtico, audio sincronizado y vocabulario resaltado en contexto (copal, cempasúchil, altar). Aquí es donde se aprende el lenguaje real.",
      },
    ],
  },
  {
    kicker: "Acto III",
    title: "Retener y volver",
    intent: "Convertir una sesión en un hábito.",
    phases: [
      {
        n: "07",
        img: "j07",
        label: "Vocabulario",
        title: "Palabras que se quedan",
        body: "Cada término guardado trae significado, contexto y una barra de dominio que sube con la práctica.",
      },
      {
        n: "08",
        img: "j08",
        label: "Práctica",
        title: "Refuerzo activo",
        body: "El vocabulario guardado se repasa en rondas de significado, contexto, escucha y emparejamiento.",
      },
      {
        n: "09",
        img: "j09",
        label: "Continuar",
        title: "Retomar sin buscar",
        body: "Todo lo que empezó queda sincronizado y listo para continuar, con un vistazo del progreso.",
      },
      {
        n: "10",
        img: "j10",
        label: "Multi-idioma",
        title: "Varios idiomas, un mismo hábito",
        body: "Desde el selector, el usuario cambia de journey o añade otro idioma sin perder su progreso.",
      },
    ],
  },
];

function PhaseCard({ phase }: { phase: Phase }) {
  return (
    <article
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        alignItems: "center",
        background: phase.core
          ? "linear-gradient(135deg, rgba(252,211,77,0.06), rgba(252,211,77,0.01))"
          : CARD_BG,
        border: `1px solid ${phase.core ? "rgba(252,211,77,0.34)" : CARD_BORDER}`,
        borderRadius: 16,
        padding: 24,
      }}
    >
      <a
        href={`/studio/journey/${phase.img}.jpg`}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          background: BEZEL,
          padding: 7,
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 12px 30px -14px rgba(0,0,0,0.7)",
          width: 232,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/studio/journey/${phase.img}.jpg`}
          alt={`Pantalla ${phase.n}: ${phase.title}`}
          style={{ display: "block", width: "100%", borderRadius: 24 }}
        />
      </a>

      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: ACCENT,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.04em",
            }}
          >
            {phase.n}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.09em",
              color: TEXT_MUTED,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 999,
              padding: "3px 9px",
            }}
          >
            {phase.label}
          </span>
          {phase.core && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                color: ACCENT,
                border: `1px solid rgba(252,211,77,0.4)`,
                background: ACCENT_SOFT,
                borderRadius: 999,
                padding: "3px 9px",
              }}
            >
              Momento clave
            </span>
          )}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
          {phase.title}
        </h3>
        <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 15, lineHeight: 1.6, maxWidth: "56ch" }}>
          {phase.body}
        </p>
      </div>
    </article>
  );
}

export default async function StudioUserJourneyPage() {
  await requireStudioUser("/studio/user-journey");

  return (
    <StudioShell
      title="User Journey"
      description="El recorrido de un usuario nuevo en la app iOS, de la bienvenida al hábito diario, en 10 pantallas reales."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "User Journey" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Intro / meta */}
        <section
          style={{
            background: "linear-gradient(135deg, rgba(252,211,77,0.09), rgba(252,211,77,0.02))",
            border: `1px solid rgba(252,211,77,0.26)`,
            borderRadius: 12,
            padding: "16px 18px",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: "var(--fg)", maxWidth: "62ch", lineHeight: 1.6 }}>
            Capturas reales de la build de iOS contra datos de producción (no maquetas). El orden refleja el recorrido de
            un usuario nuevo. Toca cualquier pantalla para verla en grande.
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

        {ACTS.map((act) => (
          <section key={act.kicker} style={{ marginTop: 20 }}>
            <header style={{ position: "relative", paddingLeft: 16, marginBottom: 16 }}>
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: 4,
                  borderRadius: 4,
                  background: ACCENT,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: ACCENT,
                }}
              >
                {act.kicker}
              </span>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", letterSpacing: "-0.015em" }}>
                {act.title}
              </h2>
              <p style={{ margin: 0, color: TEXT_MUTED, fontSize: 14 }}>{act.intent}</p>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {act.phases.map((phase) => (
                <PhaseCard key={phase.n} phase={phase} />
              ))}
            </div>
          </section>
        ))}

        <p
          style={{
            marginTop: 24,
            padding: "16px 18px",
            border: `1px dashed ${CARD_BORDER}`,
            borderRadius: 12,
            color: TEXT_MUTED,
            fontSize: 13,
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
