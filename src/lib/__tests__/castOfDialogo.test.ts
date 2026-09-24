import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

/**
 * Quien habla, en los DOS formatos (2026-09-23).
 *
 * `castOf` buscaba solo acotaciones de prosa ("dice Mariana"). En un journey
 * multipersonaje, donde quien habla va en la ETIQUETA de la linea
 * (`Mariana: ...`), no hay una sola acotacion: el reparto salia VACIO y dos
 * checks de conjunto (`journey-cast-protagonist-in-all` y el
 * "(protagonista ?)" de `journey-closing-alone`) median sobre nada. Medido en
 * el Conversations ES latam A0: los dos patrones devolvian once falsos (Tigre,
 * Luna, Rey, Se, Me, Nadie...) y ni un nombre de persona.
 *
 * Las etiquetas SE SUMAN a las acotaciones. El 95% del catalogo es prosa, asi
 * que hay un caso por camino: si el de prosa se rompe, se rompe el catalogo.
 */
const dialogo = (slug: string, cierre: string): JourneyStoryInput => ({
  slug,
  title: slug,
  text:
    `Mariana abre la puerta del edificio. Nicolas sube con una caja.\n\n` +
    `Mariana: Buenos dias. Traigo el pan.\n` +
    `Nicolas: Gracias. Yo traigo la leche.\n` +
    `Mariana: ${cierre}\n`,
  language: "ES",
  level: "A0",
  topic: "t1",
});

const prosa = (slug: string): JourneyStoryInput => ({
  slug,
  title: slug,
  text:
    `Mariana abre la puerta del edificio. "Buenos dias", dice Mariana.\n\n` +
    `Nicolas sube con una caja. "Yo traigo la leche", contesta Nicolas.\n`,
  language: "ES",
  level: "A0",
  topic: "t1",
});

const protagonista = (stories: JourneyStoryInput[]) => {
  const checks = validateJourneyStories(stories, { language: "ES", level: "A0" });
  const c = checks.find((x) => x.id === "journey-cast-protagonist-in-all");
  if (!c) throw new Error("no hay check journey-cast-protagonist-in-all");
  return c;
};

describe("castOf ve quien habla en los dos formatos", () => {
  it("formato de dialogo: el reparto sale de las etiquetas, no de acotaciones", () => {
    const c = protagonista([
      dialogo("uno", "Entonces subimos juntos."),
      dialogo("dos", "Hoy el pan esta caliente."),
      dialogo("tres", "Manana traigo yo la caja."),
    ]);
    expect(c.status).not.toBe("not-implemented");
    expect(c.detail ?? "").not.toContain("protagonista ?");
  });

  it("prosa narrada: sigue saliendo de las acotaciones", () => {
    const c = protagonista([prosa("uno"), prosa("dos"), prosa("tres")]);
    expect(c.status).not.toBe("not-implemented");
    expect(c.detail ?? "").not.toContain("protagonista ?");
  });

  it("sin etiquetas ni acotaciones no se inventa reparto", () => {
    const mudo = (slug: string): JourneyStoryInput => ({
      slug,
      title: slug,
      text: "La caja esta en la entrada. Nadie la abre.\n\nEl gato duerme encima.\n",
      language: "ES",
      level: "A0",
      topic: "t1",
    });
    const c = protagonista([mudo("uno"), mudo("dos"), mudo("tres")]);
    expect(c.status).not.toBe("pass");
  });
});

/**
 * La banda de habla citada (25-35%) es de PROSA NARRADA. Una historia en
 * formato de dialogo pone el habla en las etiquetas, no entre comillas: basta
 * una nota leida en voz alta para que entrara en la medida y saliera al 6%.
 */
describe("la banda de habla citada solo mide prosa narrada", () => {
  const banda = (stories: JourneyStoryInput[]) => {
    const c = validateJourneyStories(stories, { language: "ES", level: "A0" })
      .find((x) => x.id === "journey-quoted-speech-band");
    if (!c) throw new Error("no hay check journey-quoted-speech-band");
    return c;
  };
  const dialogoConNota = (slug: string): JourneyStoryInput => ({
    slug, title: slug, language: "ES", level: "A0", topic: "t1",
    text:
      `Mariana abre la caja en la entrada del edificio.\n\n` +
      `Mariana: Aqui hay una nota. Dice: “Me llamo Rey”.\n` +
      `Nicolas: Entonces el paquete no es tuyo.\n` +
      `Mariana: Ni tuyo. Es del gato.\n` +
      `Nicolas: El gato tiene mas correo que yo.\n`,
  });
  it("una historia de dialogo con una frase entrecomillada no entra en la banda", () => {
    expect(banda([dialogoConNota("uno"), dialogoConNota("dos")]).status).toBe("pass");
  });
});
