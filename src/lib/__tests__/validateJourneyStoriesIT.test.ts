import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

/**
 * Los dos cambios de gate del Friends IT A0 (2026-09-14):
 *  1. validateJourneyStories sabe medir italiano (reparto, presentacion, suelo
 *     A0, ninos y ancianos) en vez de devolver not-implemented.
 *  2. ctx.previas: un tema suelto se juzga con los temas anteriores delante
 *     (lo usa cierraTema).
 */

const st = (slug: string, text: string, topic = "t1"): JourneyStoryInput => ({
  slug, title: slug, text, language: "IT", level: "A0", topic,
});
const run = (stories: JourneyStoryInput[], extra: Record<string, unknown> = {}) =>
  validateJourneyStories(stories, { language: "IT", level: "A0", realPeople: ["Zzzz"], ...extra });
const check = (out: ReturnType<typeof run>, id: string) => {
  const c = out.find((x) => x.id === id);
  if (!c) throw new Error(`no hay check ${id}`);
  return c;
};

// Dos historias en las que Alice y Matteo hablan: sin eso castOf no los mete
// en el reparto (hace falta hablar en 2 historias).
const PRESENTADOS = [
  st("a", "Alice, un'infermiera di Genova, porta una torta. Matteo è un marinaio. Lui arriva alle otto.\n\n“Ciao,” dice Matteo. “Ciao,” risponde Alice."),
  st("b", "La terrazza è vuota. Il vento soffia. Il cielo è nero.\n\n“Vieni?” chiede Matteo. “Sì,” risponde Alice."),
];

describe("suelo A0 italiano (journey-a0-floor)", () => {
  it("la narracion en presente pasa", () => {
    const out = run([st("p", "Alice apre la porta. I due arrivano in piazza. Lei è arrabbiata e bagnata.")]);
    expect(check(out, "journey-a0-floor").status).toBe("pass");
  });
  it("un passato prossimo en la narracion falla", () => {
    const out = run([st("pp", "Alice ha mangiato la torta. Poi guarda il mare.")]);
    const c = check(out, "journey-a0-floor");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("passato prossimo");
  });
  it("un passato prossimo con essere de movimiento falla", () => {
    expect(check(run([st("pe", "Matteo è partito con il traghetto.")]), "journey-a0-floor").status).toBe("fail");
  });
  it("un imperfetto en la narracion falla", () => {
    const c = check(run([st("imp", "Elena non sapeva questo segreto.")]), "journey-a0-floor");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("imperfetto");
  });
  it("futuro y condizionale fallan", () => {
    expect(check(run([st("fut", "Domani Alice parlerà con lui.")]), "journey-a0-floor").status).toBe("fail");
    expect(check(run([st("cond", "Alice vorrebbe un caffè.")]), "journey-a0-floor").status).toBe("fail");
  });
  it("el pasado dentro de comillas es habla real y no cuenta", () => {
    expect(check(run([st("q", "“Ieri ho mangiato troppo,” dice Matteo.")]), "journey-a0-floor").status).toBe("pass");
  });
  it("falsos amigos del imperfetto: arriva, aperitivo, motivo, lava", () => {
    const out = run([st("fa", "Matteo arriva con un aperitivo. Alice lava i piatti senza un motivo.")]);
    expect(check(out, "journey-a0-floor").status).toBe("pass");
  });
});

describe("presentacion de personajes en italiano", () => {
  it("aposicion y con essere pasan", () => {
    expect(check(run(PRESENTADOS), "journey-character-introduction").status).toBe("pass");
  });
  it("dopo il luogo pasa", () => {
    const out = run([
      st("a", "Sul pianerottolo c'è Riccardo, un tassista del terzo piano. Lui ride forte.\n\n“Ciao,” dice Riccardo. “Ciao,” risponde Alice. Alice, un'infermiera, sorride."),
      st("b", "Il derby comincia. La terrazza è piena.\n\n“Gol!” grida Riccardo. “No!” dice Alice."),
    ]);
    const c = check(out, "journey-character-introduction");
    // Alice se presenta DESPUES de su primera cita en "a": falla por eso, no por Riccardo.
    expect(c.detail ?? "").not.toContain("Riccardo");
  });
  it("sin sintagma que diga que es, falla", () => {
    const out = run([
      st("a", "Oggi c'è il sole. La terrazza è grande. Il mare brilla.\n\n“Ciao,” dice Matteo. “Ciao,” risponde Alice."),
      st("b", "La terrazza è vuota. Il vento soffia. Il cielo è nero.\n\n“Vieni?” chiede Matteo. “Sì,” risponde Alice."),
    ]);
    const c = check(out, "journey-character-introduction");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("Matteo");
    expect(c.detail).toContain("Alice");
  });
});

describe("ninos y ancianos en italiano", () => {
  it("nonna y bambino se detectan", () => {
    const c = check(run([st("n", "La nonna di Alice guarda il bambino.")]), "journey-no-elderly-no-children");
    expect(c.status).toBe("fail");
    expect(c.detail).toMatch(/nonna/i);
    expect(c.detail).toMatch(/bambino/i);
  });
  it("ragazza es un adulto joven y no cuenta", () => {
    expect(check(run([st("r", "La ragazza del quarto piano sorride.")]), "journey-no-elderly-no-children").status).toBe("pass");
  });
});

describe("ctx.previas: un tema suelto con los temas anteriores delante", () => {
  // Tema 2: los fijos ya salieron en el tema 1 (previas) y Francesca se estrena.
  const TEMA2 = [
    st("t2a", "Sul telefono c'è Francesca, una biologa dell'Acquario. Matteo ride. Alice apre la porta.\n\n“Lei è Francesca,” dice Matteo. “Carina,” risponde Alice. “Ciao!” dice Francesca.", "t2"),
    st("t2b", "Francesca arriva presto. Alice scende le scale. Il palazzo è vecchio.\n\n“Ciao, Alice,” dice Francesca. “Ciao,” risponde Alice. “Allora?” chiede Matteo.", "t2"),
  ];
  const previas = PRESENTADOS.map((s) => ({ text: s.text }));

  it("un personaje nuevo que se estrena presentado en el tema 2 pasa, y los fijos no se re-presentan", () => {
    const out = run(TEMA2, { previas, conjuntoCompleto: false });
    expect(check(out, "journey-character-introduction").status).toBe("pass");
  });
  it("sin previas, los fijos del tema 2 vuelven a exigir presentacion (comportamiento de siempre)", () => {
    const c = check(run(TEMA2, { conjuntoCompleto: false }), "journey-character-introduction");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("Matteo");
  });
  it("con previas, un personaje que NO sale en el journey antes y no se presenta sigue fallando", () => {
    const sinPresentar = [
      st("t2a", "Il telefono suona. Matteo ride. Alice apre la porta.\n\n“Ciao!” dice Francesca. “Ciao,” risponde Alice.", "t2"),
      st("t2b", "La mattina è fresca. Alice scende le scale. Il palazzo è vecchio.\n\n“Allora?” chiede Francesca. “Niente,” risponde Alice.", "t2"),
    ];
    const c = check(run(sinPresentar, { previas, conjuntoCompleto: false }), "journey-character-introduction");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("Francesca");
    expect(c.detail).not.toContain("Alice");
  });
  it("con previas, first-story-only-fixed no toma la primera del tema por la del journey", () => {
    expect(check(run(TEMA2, { previas, conjuntoCompleto: false }), "journey-cast-first-story-only-fixed").status).toBe("pass");
  });
  it("sin previas, tres personajes en la primera historia siguen fallando", () => {
    expect(check(run(TEMA2, { conjuntoCompleto: false }), "journey-cast-first-story-only-fixed").status).toBe("fail");
  });
});
