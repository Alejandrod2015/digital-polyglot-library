import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

/**
 * La cola de portables tiene otro tope en formato DIALOGO (2026-09-23).
 *
 * En dialogo, esta regla y `vocab-taught-same-type` se contradicen: la segunda
 * pide que las 420 plazas del journey sean palabras distintas y esta pide que
 * cada una salga en dos o mas cuerpos. Con el tope del 30% hacen falta unas 294
 * palabras que se repitan entre historias, y las 21 escenas cortas del primer
 * journey de dialogo solo contienen 220. Cumplirlo como estaba costo 95 plazas
 * con la definicion vacia, que es lo que el lector toca en la app.
 *
 * Los dos numeros de dialogo (cola 0,55 y media 2,2) estan calibrados con UNA
 * muestra, asi que estos casos fijan el COMPORTAMIENTO, no el numero: que la
 * prosa conserve los suyos, que el formato lo decida el journey entero y no una
 * historia suelta, y que el detalle diga cual se aplico.
 */
const vocab = (palabras: string[]) =>
  // La primera va anclada: sin una sola plaza marcada, el check cae en la rama
  // vieja que ni separa portables ni mide cola.
  palabras.map((w, i) => ({ word: w, type: "noun", definition: `The ${w}; a thing in the story.`,
    ...(i === 0 ? { anchor: true } : {}) }));

/** Cuerpo de dialogo cuyas plazas salen SOLO aqui: cola del 100%. */
const dialogo = (slug: string, unicas: string[]): JourneyStoryInput => ({
  slug, title: slug, language: "ES", level: "A0", topic: slug,
  text:
    `Mariana abre la puerta del edificio.\n\n` +
    `Mariana: Aqui esta el ${unicas[0]}.\n` +
    `Nicolas: Y el ${unicas[1]} tambien.\n` +
    `Mariana: Falta el ${unicas[2]}.\n` +
    `Nicolas: Y el ${unicas[3]}.\n`,
  vocab: vocab(unicas),
});

/** Misma cola, en prosa narrada. */
const prosa = (slug: string, unicas: string[]): JourneyStoryInput => ({
  slug, title: slug, language: "ES", level: "A0", topic: slug,
  text:
    `Mariana abre la puerta del edificio. Ahi esta el ${unicas[0]}.\n\n` +
    `Nicolas trae el ${unicas[1]}. Falta el ${unicas[2]} y el ${unicas[3]}.\n`,
  vocab: vocab(unicas),
});

const cola = (stories: JourneyStoryInput[]) => {
  const c = validateJourneyStories(stories, { language: "ES", level: "A0", conjuntoCompleto: true })
    .find((x) => x.id === "journey-vocab-recirculation");
  if (!c) throw new Error("no hay check journey-vocab-recirculation");
  return c;
};

const PALABRAS = [
  ["banco", "cesto", "farol", "timbre"],
  ["cordel", "peldano", "buzon", "tejado"],
  ["cartel", "portal", "rejilla", "toldo"],
];

describe("el tope de la cola distingue dialogo de prosa", () => {
  it("en prosa, una cola del 100% sigue fallando con el tope del nivel", () => {
    const c = cola(PALABRAS.map((p, i) => prosa(`prosa-${i}`, p)));
    expect(c.status).toBe("fail");
    expect(c.detail ?? "").toContain("tope 30%");
  });

  it("en dialogo se aplica el tope de dialogo, y se dice en el detalle", () => {
    const c = cola(PALABRAS.map((p, i) => dialogo(`dialogo-${i}`, p)));
    expect(c.detail ?? "").toContain("tope 55% de dialogo");
  });

  it("una sola historia de dialogo no convierte el journey en journey de dialogo", () => {
    const mezcla = [dialogo("uno", PALABRAS[0]), prosa("dos", PALABRAS[1]), prosa("tres", PALABRAS[2])];
    expect(cola(mezcla).detail ?? "").toContain("tope 30%");
  });

  it("el suelo de la media tambien baja en dialogo, y en prosa no", () => {
    // La media cuenta en cuantos cuerpos sale la palabra de cada plaza, asi
    // que sufre lo mismo que la cola. No es un liston de calidad mas bajo:
    // en dialogo la mitad del vocab son formulas de turno que, si vuelven,
    // suenan a plantilla.
    expect(cola(PALABRAS.map((p, i) => dialogo(`dialogo-${i}`, p))).label).toContain("media 2.2");
    expect(cola(PALABRAS.map((p, i) => prosa(`prosa-${i}`, p))).label).toContain("media 2.5");
  });
});
