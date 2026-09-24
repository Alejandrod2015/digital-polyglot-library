import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

/**
 * Suelo A0 espanol (journey-a0-floor), escrito el 2026-09-22 montando el
 * Friends ES Mexico A0. Antes devolvia not-implemented para todo lo que no
 * fuera aleman, frances o italiano, y eso BLOQUEA `cierraTema`.
 *
 * Los dos ultimos casos son las falsas alarmas reales que salieron al calibrar
 * contra las 21 historias del Traveler ES latam A0: la tilde es lo que separa
 * el verbo de su homografo, asi que el detector no normaliza acentos.
 */
const st = (slug: string, text: string, topic = "t1"): JourneyStoryInput => ({
  slug, title: slug, text, language: "ES", level: "A0", topic,
});
const run = (stories: JourneyStoryInput[]) =>
  validateJourneyStories(stories, { language: "ES", level: "A0", realPeople: ["Zzzz"] });
const floor = (stories: JourneyStoryInput[]) => {
  const c = run(stories).find((x) => x.id === "journey-a0-floor");
  if (!c) throw new Error("no hay check journey-a0-floor");
  return c;
};

describe("suelo A0 espanol (journey-a0-floor)", () => {
  it("la narracion en presente pasa", () => {
    expect(floor([st("p", "Itzel sube a la azotea. El sol pega fuerte. Bruno cuelga una camisa.")]).status).toBe("pass");
  });

  it("un preterito en la narracion falla", () => {
    const c = floor([st("pret", "Itzel subió a la azotea. Bruno mira el cielo.")]);
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("preterito");
  });

  it("un preterito irregular falla", () => {
    expect(floor([st("irr", "Bruno fue al mercado con una cubeta.")]).status).toBe("fail");
  });

  it("un imperfecto falla", () => {
    const c = floor([st("imp", "Itzel tenía dos pinzas en la mano.")]);
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("imperfecto");
  });

  it("un perfecto compuesto falla", () => {
    expect(floor([st("perf", "Bruno ha perdido la llave otra vez.")]).status).toBe("fail");
  });

  it("un futuro sintetico falla, pero ir a + infinitivo no", () => {
    expect(floor([st("fut", "Itzel llegará tarde a la azotea.")]).status).toBe("fail");
    expect(floor([st("perif", "Itzel va a llegar tarde. Bruno la espera.")]).status).toBe("pass");
  });

  it("el pasado dentro de una linea citada no cuenta: es habla real", () => {
    expect(floor([st("cita", "Bruno abre la puerta.\n\n“Ayer perdí la llave,” dice Bruno.")]).status).toBe("pass");
  });

  it("“seria” adjetivo no es condicional, y “hacia” preposicion no es imperfecto", () => {
    expect(floor([st("tilde", "Su mamá toma la foto y está seria un momento. Mira hacia el alebrije.")]).status).toBe("pass");
  });

  it("una taqueria no es un imperfecto", () => {
    expect(floor([st("tienda", "La taquería de la esquina abre temprano. Bruno pide dos de pastor.")]).status).toBe("pass");
  });

  it("detras y atras no son futuro", () => {
    expect(floor([st("detras", "Itzel camina detrás de Bruno. El perro va atrás.")]).status).toBe("pass");
  });
});
