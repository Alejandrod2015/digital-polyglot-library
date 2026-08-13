"use client";

import { useCallback, useEffect, useState } from "react";

const ACCENT = "#fcd34d";
const ACCENT_SOFT = "rgba(252, 211, 77, 0.14)";
// Verde solo para la subsección de beta: marca lo que NO es el recorrido.
const FB_ACCENT = "#34d399";
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
  act: string;
};

type Act = { kicker: string; title: string; intent: string; phases: Omit<Phase, "act">[] };

const ACTS: Act[] = [
  {
    kicker: "Acto I",
    title: "Empezar",
    intent: "Del primer toque a un punto de partida a medida.",
    phases: [
      { n: "01", img: "j01", label: "Bienvenida", title: "La promesa, en la primera pantalla", body: "Al abrir la app, el usuario ve la propuesta central y las formas de entrar: Google, Facebook o email. Un solo objetivo en foco: empezar." },
      { n: "02", img: "j02", label: "Onboarding", title: "Elige qué quieres aprender", body: "Paso 1 de 4. El primer idioma se vuelve el journey inicial; el resto queda listo en el selector. Selección múltiple, cero fricción." },
      { n: "03", img: "j03", label: "Test de nivel", title: "Empieza en el nivel correcto", body: "Un quiz opcional de 10 preguntas para ubicar al usuario: ni aburrido ni perdido. 'Hola, ___ Ana' con soy/estoy/hay/es." },
      { n: "04", img: "j04", label: "Tour guiado", title: "Un tour que señala cada zona", body: "Coachmarks que aparecen sobre el Home al entrar (4 pasos), señalando cada zona: Journey, Explore, Practice y Favorites." },
    ],
  },
  {
    kicker: "Acto II",
    title: "El journey",
    intent: "El corazón: el camino guiado, abrir una historia, guardar palabras y cerrar el loop.",
    phases: [
      { n: "05", img: "j05", label: "Tu journey", title: "El camino guiado, por niveles", core: true, body: "El corazón del producto: historias encadenadas por nivel (Food & Drink, Home & Family...) con racha, XP y tu avance. Se sigue de arriba hacia abajo, en secuencia." },
      { n: "06", img: "j06", label: "Abrir historia", title: "Del camino a la historia", body: "Tocar un nodo del journey abre la historia (aquí 'La promesa del mole'): texto auténtico, audio y vocabulario resaltado, listo para tocar." },
      { n: "07", img: "j07", label: "Guardar palabra", title: "Toca una palabra, guárdala", body: "Cualquier palabra resaltada abre su significado en contexto ('colgar: to hang up') con un botón Save word. Así se llena tu vocabulario." },
      { n: "08", img: "j08", label: "Fin de historia", title: "Cierra y consolida", body: "Al terminar, 'Lock it in': practica ahora las palabras de la historia. Recuerdas 2× más practicando justo después de leer." },
    ],
  },
  {
    kicker: "Acto III",
    title: "Practicar y retener",
    intent: "El pago del loop: repasar lo guardado y volver mañana.",
    phases: [
      { n: "09", img: "j09", label: "Vocabulario", title: "Palabras que se quedan", body: "Cada término guardado trae significado, contexto y una barra de dominio que sube con la práctica." },
      { n: "10", img: "j10", label: "Práctica", title: "Refuerzo activo con tu vocab", body: "Desde tus palabras guardadas: rondas de significado, contexto, escucha y match. 'All caught up' cuando estás al día." },
      { n: "11", img: "j11", label: "Ronda de práctica", title: "El ejercicio, en acción", body: "Multiple choice contra reloj. Aquí 'colgar' (la palabra que guardaste): to pick up / to hang up / to dial / to answer. +XP y gemas por acierto." },
      { n: "12", img: "j12", label: "Progreso", title: "Racha, XP y metas", body: "Panel semanal: racha, XP por nivel, precisión, palabras aprendidas y objetivos de historias, minutos y práctica." },
      { n: "13", img: "j13", label: "Continuar", title: "Retomar sin buscar", body: "Todo lo que empezó queda sincronizado y listo para continuar, con un vistazo del progreso." },
      { n: "14", img: "j14", label: "Recordatorio", title: "Un empujón diario, opcional", body: "El usuario elige la hora de un único aviso al día. Es el gancho de retención, sin ser intrusivo." },
    ],
  },
  {
    kicker: "Acto IV",
    title: "Explorar la biblioteca",
    intent: "Un modo paralelo al journey: navegar el catálogo libremente, por interés.",
    phases: [
      { n: "15", img: "j15", label: "Explorar", title: "Una biblioteca viva", body: "Fuera del camino guiado: 80 historias filtrables por tema y nivel, con portadas propias. Se elige por interés, en cualquier orden." },
      { n: "16", img: "j16", label: "Colección", title: "Contexto antes de entrar", body: "Cada colección (p. ej. Colombian Spanish Stories) muestra nivel, duración media y valoración; abre en el mismo lector del journey." },
    ],
  },
  {
    kicker: "Acto V",
    title: "Cuenta y acceso",
    intent: "Navegar, gestionar idiomas, ajustar y mejorar.",
    phases: [
      { n: "17", img: "j17", label: "Menú", title: "Todo a un toque", body: "Acceso a Progreso, Ajustes, Library, Saved, Story of the Day, Upgrade y Sign out." },
      { n: "18", img: "j18", label: "Tus journeys", title: "Uno o varios idiomas", body: "El journey activo (Spanish · Travelers · Elementary) con su progreso; se cambia de journey o se añade otro idioma sin perder avance." },
      { n: "19", img: "j19", label: "Ajustes", title: "Cuenta y preferencias", body: "Cuenta, plan, personalización y privacidad; incluye el recordatorio diario, soporte y el acceso a los planes." },
      { n: "20", img: "j20", label: "Premium", title: "Desbloquear todo", body: "Go Premium: todas las historias, acceso offline, práctica completa y las palabras guardadas. Compra vía App Store." },
    ],
  },
];

// ── Subsección: pedir feedback ──────────────────────────────────────────
// No es un acto más del recorrido: es una capa que se monta ENCIMA de él,
// solo para beta testers, y por eso va aparte y con su propio acento.
//
// La regla que la ordena: el feedback se pide en el momento en que la
// persona ACABA de vivir algo, no en una pantalla a la que hay que ir a
// buscar. Un buzón en Ajustes solo lo recorre quien está enfadado, así que
// lo tibio (que es lo accionable) no llegaba nunca.
const FEEDBACK_ACT = "Pedir feedback";
const FEEDBACK_MOMENTS: Array<Omit<Phase, "act"> & { when: string; strength: "momento" | "buzón" }> = [
  {
    n: "F1",
    img: "f01",
    label: "Ajustes",
    title: "El buzón, para cuando busques dónde quejarte",
    when: "Cuando la persona VA a buscarlo",
    strength: "buzón",
    body:
      "Donde antes había un botón fantasma que abría el cliente de correo (y por tanto no lo usaba nadie) hay ahora una tarjeta que dice para qué sirve. Sigue siendo el camino débil: exige que la persona decida ir a Ajustes, o sea que ya venga con una queja formada. Está para no perder a quien la tiene, no para recoger la mayoría.",
  },
  {
    n: "F2",
    img: "f02",
    label: "El panel",
    title: "Una frase basta, y el contexto se adjunta solo",
    when: "El mismo panel desde cualquier entrada",
    strength: "buzón",
    body:
      "Cuatro categorías (Broke / Confusing / Idea / Liked it), un campo libre y nada más. Debajo, en gris: build, dispositivo y la pantalla desde la que se abrió. Nadie tiene que describir su versión ni adivinar qué información necesitas: llega sola.",
  },
  {
    n: "F3",
    img: "f03",
    label: "Fin de práctica",
    title: "El único momento en que ha vivido el bucle entero",
    when: "Justo después de leer, escuchar y practicar",
    strength: "momento",
    body:
      "Leyó, escuchó y acaba de practicar lo leído: aquí sabe de verdad si funcionó. El enlace va debajo de WHAT'S NEXT, deliberadamente discreto y NO como cuarta tarjeta: esa fila empuja a seguir, y el paso de historia a práctica ya pierde gente. Preguntar aquí cuesta un toque.",
  },
  {
    n: "F4",
    img: "f04",
    label: "El panel, en contexto",
    title: "Sabrás si la queja viene de leer o de practicar",
    when: "Abierto desde el final de la ronda",
    strength: "momento",
    body:
      "Mismo panel, distinto rastro: el contexto pasa de 'Settings' a 'practice complete'. Sin preguntar nada extra, cada mensaje llega ya clasificado por el punto del recorrido donde se generó.",
  },
  {
    n: "F5",
    img: "f05",
    label: "Fin de historia",
    title: "Para quien lee y no practica",
    when: "Al terminar una historia, antes de practicar",
    strength: "momento",
    body:
      "Debajo de la puerta a la práctica, y solo cuando la historia está TERMINADA de verdad: a quien únicamente hojeó hasta el final no se le pregunta nada. Este es el momento que faltaba, porque el paso de historia a práctica pierde gente, y quien se queda por el camino no tenía dónde opinar salvo Ajustes.",
  },
  {
    n: "F6",
    img: "f06",
    label: "El panel, desde la historia",
    title: "El tercer rastro: 'story complete'",
    when: "Abierto desde el final de la historia",
    strength: "momento",
    body:
      "Tres entradas, un solo panel, tres contextos distintos. Un problema del lector (audio, resaltado, toque en una palabra) llega marcado como historia; uno de los ejercicios llega marcado como práctica. La clasificación sale gratis.",
  },
];

const FLAT: Phase[] = [
  ...ACTS.flatMap((a) => a.phases.map((p) => ({ ...p, act: a.title }))),
  ...FEEDBACK_MOMENTS.map((p) => ({ ...p, act: FEEDBACK_ACT })),
];

function Thumb({ phase, onOpen }: { phase: Phase; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 150,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        font: "inherit",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "block",
          background: BEZEL,
          padding: 5,
          borderRadius: 20,
          border: `1px solid ${phase.core ? "rgba(252,211,77,0.5)" : "rgba(255,255,255,0.07)"}`,
          boxShadow: phase.core
            ? "0 0 0 1px rgba(252,211,77,0.25), 0 10px 24px -14px rgba(0,0,0,0.7)"
            : "0 8px 22px -14px rgba(0,0,0,0.7)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/studio/journey/${phase.img}.jpg`}
          alt={`Pantalla ${phase.n}: ${phase.title}`}
          loading="lazy"
          style={{ display: "block", width: "100%", borderRadius: 15 }}
        />
        {phase.core && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#1a1204",
              background: ACCENT,
              borderRadius: 999,
              padding: "2px 7px",
              whiteSpace: "nowrap",
            }}
          >
            Momento clave
          </span>
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, paddingInline: 2 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
            {phase.n}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: TEXT_MUTED }}>
            {phase.label}
          </span>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{phase.title}</span>
      </span>
    </button>
  );
}

export default function JourneyGallery() {
  const [selected, setSelected] = useState<number | null>(null);
  const isOpen = selected !== null;

  const close = useCallback(() => setSelected(null), []);
  const step = useCallback(
    (dir: number) => setSelected((s) => (s === null ? s : (s + dir + FLAT.length) % FLAT.length)),
    []
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, step]);

  const current = selected === null ? null : FLAT[selected];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {ACTS.map((act, ai) => {
          const start = ACTS.slice(0, ai).reduce((n, a) => n + a.phases.length, 0);
          return (
            <section key={act.kicker}>
              <header style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: ACCENT }}>
                  {act.kicker}
                </span>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{act.title}</h2>
                <span style={{ fontSize: 12.5, color: TEXT_MUTED }}>{act.intent}</span>
              </header>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
                {act.phases.map((p, pi) => (
                  <Thumb key={p.n} phase={{ ...p, act: act.title }} onOpen={() => setSelected(start + pi)} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Subsección aparte: no es una etapa del recorrido, es la capa de
            beta que se monta encima. Va en su propio recuadro para que no
            se lea como "lo que hace un usuario nuevo". */}
        <section
          style={{
            marginTop: 8,
            paddingTop: 20,
            borderTop: `1px solid ${CARD_BORDER}`,
          }}
        >
          <header style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: FB_ACCENT,
              }}
            >
              Beta
            </span>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Pedir feedback</h2>
            <span style={{ fontSize: 12.5, color: TEXT_MUTED }}>
              Dónde se pregunta, y por qué ahí.
            </span>
          </header>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--fg)",
              opacity: 0.82,
              maxWidth: "78ch",
            }}
          >
            La regla: se pregunta en el momento en que la persona <strong>acaba de vivir algo</strong>, no en una
            pantalla a la que hay que ir a buscar. Pedirle que entre a Ajustes es pedirle demasiado: ese camino solo
            lo recorre quien ya viene enfadado, y el feedback tibio, que es el accionable, no llegaba nunca.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {FEEDBACK_MOMENTS.map((p, pi) => (
              <div key={p.n} style={{ display: "flex", flexDirection: "column", gap: 7, width: 150 }}>
                <Thumb
                  phase={{ ...p, act: FEEDBACK_ACT }}
                  onOpen={() => setSelected(FLAT.length - FEEDBACK_MOMENTS.length + pi)}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    lineHeight: 1.35,
                    color: p.strength === "momento" ? FB_ACCENT : TEXT_MUTED,
                    border: `1px solid ${p.strength === "momento" ? "rgba(52,211,153,0.35)" : CARD_BORDER}`,
                    background: p.strength === "momento" ? "rgba(52,211,153,0.10)" : "transparent",
                    borderRadius: 8,
                    padding: "5px 8px",
                  }}
                >
                  {p.when}
                </span>
              </div>
            ))}
          </div>
          <p
            style={{
              margin: "16px 0 0",
              padding: "12px 14px",
              border: `1px dashed ${CARD_BORDER}`,
              borderRadius: 12,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: TEXT_MUTED,
              maxWidth: "82ch",
            }}
          >
            <strong style={{ color: "var(--fg)", opacity: 0.85 }}>Momentos cubiertos:</strong> el final de una ronda de
            práctica (F3), donde ha vivido el bucle entero, y el final de una historia (F5), que alcanza además a quien
            lee y no practica. Ajustes (F1) se queda como red, no como camino principal.{" "}
            <strong style={{ color: "var(--fg)", opacity: 0.85 }}>Lo que sigue sin cubrirse:</strong> el abandono. Quien
            deja una historia a medias o sale de la práctica sin terminar no ve ninguna de las dos puertas, y es
            justamente de quien más se aprendería. Preguntar ahí es delicado: interrumpir a alguien que ya se está
            yendo puede empujarlo del todo.
          </p>
        </section>
      </div>

      {current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pantalla ${current.n}: ${current.title}`}
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(3, 6, 12, 0.82)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            aria-label="Anterior"
            style={navBtn("left")}
          >
            ‹
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 28,
              alignItems: "center",
              maxWidth: 820,
              width: "100%",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                background: BEZEL,
                padding: 8,
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 24px 60px -24px rgba(0,0,0,0.8)",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/studio/journey/${current.img}.jpg`}
                alt={`Pantalla ${current.n}: ${current.title}`}
                style={{ display: "block", height: "min(78vh, 620px)", width: "auto", borderRadius: 24 }}
              />
            </span>

            <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
                  {current.n}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT_MUTED, border: `1px solid ${CARD_BORDER}`, borderRadius: 999, padding: "3px 9px" }}>
                  {current.label}
                </span>
                {current.core && (
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, background: ACCENT_SOFT, border: "1px solid rgba(252,211,77,0.4)", borderRadius: 999, padding: "3px 9px" }}>
                    Momento clave
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_MUTED, marginBottom: 6 }}>
                {current.act}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {current.title}
              </h3>
              <p style={{ margin: 0, color: "var(--fg)", opacity: 0.86, fontSize: 15, lineHeight: 1.65 }}>{current.body}</p>
              <div style={{ marginTop: 20, fontSize: 12, color: TEXT_MUTED }}>
                {selected! + 1} / {FLAT.length} &nbsp;·&nbsp; ← → para navegar, Esc para cerrar
              </div>
            </div>
          </div>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); step(1); }}
            aria-label="Siguiente"
            style={navBtn("right")}
          >
            ›
          </button>

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Cerrar"
            style={{
              position: "fixed",
              top: 20,
              right: 22,
              width: 40,
              height: 40,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "fixed",
    [side]: 16,
    top: "50%",
    transform: "translateY(-50%)",
    width: 46,
    height: 46,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 26,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
