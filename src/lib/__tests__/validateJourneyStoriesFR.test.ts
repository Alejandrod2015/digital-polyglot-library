import { describe, it, expect } from "vitest";
import { validateJourneyStories, type JourneyStoryInput } from "../validateJourneyStories";

/**
 * Puntos ciegos del francés narrado en pasado (Friends FR B1, 2026-09-14):
 *  b) HABLA_POR_IDIOMA.FR solo tenia presente; una historia narrada en passé
 *     composé/imparfait no casaba con nada y castOf devolvia el reparto
 *     vacio (journey-cast-protagonist-in-all pasaba a not-implemented).
 *  c) FORMAS_FR "con etre" usaba \b antes del nombre, que no casa antes de
 *     una letra acentuada (Élodie), asi que un personaje BIEN presentado con
 *     "est une jeune femme..." salia como "sin sintagma que diga que es".
 */

const st = (slug: string, text: string, topic = "t1"): JourneyStoryInput => ({
  slug, title: slug, text, language: "FR", level: "B1", topic,
});
const run = (stories: JourneyStoryInput[], extra: Record<string, unknown> = {}) =>
  validateJourneyStories(stories, { language: "FR", level: "B1", realPeople: ["Zzzz"], conjuntoCompleto: true, ...extra });
const check = (out: ReturnType<typeof run>, id: string) => {
  const c = out.find((x) => x.id === id);
  if (!c) throw new Error(`no hay check ${id}`);
  return c;
};

describe("reparto frances en pasado (journey-cast-protagonist-in-all)", () => {
  it("con presente, el reparto se detecta (control)", () => {
    const out = run([
      st("a", "Aurélien range la cuisine. Élodie arrive avec les courses.\n\n“Ça va ?” demande Aurélien. “Oui,” répond Élodie."),
      st("b", "Le café est vide. Aurélien attend.\n\n“Tu es en retard,” dit Aurélien. “Pardon,” répond Élodie."),
    ], { conjuntoCompleto: false });
    expect(check(out, "journey-cast-protagonist-in-all").status).not.toBe("not-implemented");
  });

  it("narrado en passé composé/imparfait, el reparto NO sale vacio", () => {
    const out = run([
      st("a", "Aurélien a rangé la cuisine. Élodie est arrivée avec les courses.\n\n“Ça va ?” a demandé Aurélien. “Oui,” a répondu Élodie."),
      st("b", "Le café était vide. Aurélien attendait.\n\n“Tu es en retard,” a dit Aurélien. “Pardon,” a répondu Élodie."),
    ], { conjuntoCompleto: false });
    expect(check(out, "journey-cast-protagonist-in-all").status).not.toBe("not-implemented");
  });

  it("a dit / a répondu cuentan como dit / répondu (imparfait tambien)", () => {
    const out = run([
      st("a", "Aurélien a rangé la cuisine.\n\n“Ça va ?” a demandé Aurélien. “Oui,” a répondu Élodie."),
      st("b", "Le café était vide.\n\n“Tu es en retard,” disait Aurélien. “Pardon,” répondait Élodie."),
    ], { conjuntoCompleto: false });
    expect(check(out, "journey-cast-protagonist-in-all").status).not.toBe("not-implemented");
  });
});

describe("presentacion francesa con nombre acentuado (journey-character-introduction)", () => {
  it("Élodie presentada con 'est une' pasa", () => {
    const out = run([
      st("a", "Élodie est une jeune femme de Lille. Aurélien, un voisin du troisième, monte avec un sac.\n\n“Ça va ?” demande Aurélien. “Oui,” répond Élodie."),
      st("b", "Aurélien attend. Élodie arrive.\n\n“Tu es en retard,” dit Aurélien. “Pardon,” répond Élodie."),
    ]);
    expect(check(out, "journey-character-introduction").status).toBe("pass");
  });

  it("Élodie SIN presentar falla", () => {
    const out = run([
      st("a", "Élodie arrive avec les courses. Aurélien, un voisin du troisième, monte avec un sac.\n\n“Ça va ?” demande Aurélien. “Oui,” répond Élodie."),
      st("b", "Aurélien attend. Élodie sourit.\n\n“Tu es en retard,” dit Aurélien. “Pardon,” répond Élodie."),
    ]);
    const c = check(out, "journey-character-introduction");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("Élodie");
  });

  it("control: un nombre sin tilde con 'est une' sigue pasando igual que antes", () => {
    const out = run([
      st("a", "Manon est une jeune femme de Clermont-Ferrand. Aurélien, un voisin du troisième, monte avec un sac.\n\n“Ça va ?” demande Aurélien. “Oui,” répond Manon."),
      st("b", "Aurélien attend. Manon arrive.\n\n“Tu es en retard,” dit Aurélien. “Pardon,” répond Manon."),
    ]);
    expect(check(out, "journey-character-introduction").status).toBe("pass");
  });
});
