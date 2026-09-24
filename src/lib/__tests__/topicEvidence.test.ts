import { describe, it, expect, vi } from "vitest";
import { assertTopicsGrounded, reportTopicEvidence, TopicEvidenceError, type TopicProposal } from "../topicEvidence";
import { CityNotApprovedError } from "../approvedCities";
import type { PrismaClient } from "@/generated/prisma";

/**
 * El corpus de mentira imita a la base real del 2026-08-19: el francés tiene
 * dos solicitudes cuya `motivation` es un clic del desplegable ("Move abroad",
 * "Travel") y dos `applicationReason` escritos a mano.
 */
const ROWS = [
  {
    targetLanguage: "French",
    motivation: "Move abroad",
    learningGoal: null,
    applicationReason:
      "I received the email invitation and I am hoping this language app is one I'll actually " +
      "stick with to learn French. I plan to move there in 6-8 months.",
  },
  {
    targetLanguage: "French",
    motivation: "Travel",
    learningGoal: null,
    applicationReason:
      "I'd like to be able to contribute to the development of a useful app for language learners.",
  },
  {
    targetLanguage: "Spanish",
    motivation: "Holiday home in Spain and I wish to talk to neighbours",
    learningGoal: null,
    applicationReason: null,
  },
];

function fakePrisma(rows: typeof ROWS = ROWS) {
  return {
    betaSignup: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaClient;
}

/** Los siete temas del Expat francés, seis de ellos con la misma cadena enlatada. */
const EXPAT_FRENCH: TopicProposal[] = [
  { label: "Arrival & First Night", evidence: ["move abroad"] },
  { label: "Finding An Apartment", evidence: ["move abroad"] },
  { label: "Paperwork & Registration", evidence: ["move abroad"] },
  { label: "Opening A Bank Account", evidence: ["move abroad"] },
  { label: "Phone & Internet", evidence: ["move abroad"] },
  { label: "Neighbors & Building", evidence: ["move abroad"] },
  { label: "First Day At Work", evidence: ["work"] },
];

type Row = { targetLanguage: string; motivation: string | null; learningGoal: string | null; applicationReason: string | null };
const rows = (r: Row[]) => r as unknown as typeof ROWS;

// Desde el 2026-09-15 las motivaciones son PISTA, no filtro: la falta de cita
// avisa y no tira. Solo tiran las reglas de nombre.
describe("reportTopicEvidence", () => {
  it("marca los siete temas del Expat francés como sin pista, sin tirar", async () => {
    const r = await reportTopicEvidence({ language: "French", proposals: EXPAT_FRENCH, prisma: fakePrisma() });

    expect(r.topics.every((t) => !t.cited)).toBe(true);
    for (const p of EXPAT_FRENCH) expect(r.evidenceWarnings.join("\n")).toContain(`"${p.label}"`);
    expect(r.evidenceWarnings.join("\n")).toContain("demasiado cortas");
    expect(r.nameProblems).toEqual([]);
  });

  it("no cuenta el valor enlatado del desplegable como pista", async () => {
    const r = await reportTopicEvidence({
      language: "French",
      proposals: [{ label: "Family & Relatives", evidence: ["family connection"] }],
      prisma: fakePrisma(rows([
        { targetLanguage: "French", motivation: "Family connection", learningGoal: null, applicationReason: "To try new ways to learn" },
      ])),
    });
    expect(r.cannedClicks).toBe(1);
    expect(r.topics[0].cited).toBe(false);
  });

  it("avisa de una cita larga que nadie escribió", async () => {
    const r = await reportTopicEvidence({
      language: "French",
      proposals: [{ label: "Houses & Mortgages", evidence: ["buying a house in Lyon next year"] }],
      prisma: fakePrisma(),
    });
    expect(r.evidenceWarnings.join("\n")).toContain("nadie escribió");
  });

  it("cuenta las frases ESCRITAS, no las filas", async () => {
    const r = await reportTopicEvidence({
      language: "French",
      proposals: [{ label: "Phone & Internet", evidence: ["move abroad"] }],
      prisma: fakePrisma(),
    });
    // 2 clics + 2 applicationReason: cero motivaciones escritas.
    expect(r).toMatchObject({ writtenMotivations: 0, applicationReasons: 2, cannedClicks: 2, corpusSize: 2 });
  });

  it("reconoce texto libre de verdad, de motivation, learningGoal y applicationReason", async () => {
    const fr = await reportTopicEvidence({
      language: "French",
      proposals: [{ label: "Moving & Deadlines", evidence: ["plan to move there in 6-8 months"] }],
      prisma: fakePrisma(),
    });
    expect(fr.topics[0]).toMatchObject({ cited: true, applicants: 1 });
    expect(fr.evidenceWarnings).toEqual([]);

    const es = await reportTopicEvidence({
      language: "Spanish",
      proposals: [{ label: "Neighbours & Favours", evidence: ["wish to talk to neighbours"] }],
      prisma: fakePrisma(),
    });
    expect(es.topics[0].cited).toBe(true);

    const pt = await reportTopicEvidence({
      language: "Portuguese",
      proposals: [{ label: "Markets & Fruit", evidence: ["buy fruit at the market"] }],
      prisma: fakePrisma(rows([
        { targetLanguage: "Portuguese", motivation: "Travel", learningGoal: "I want to buy fruit at the market without pointing", applicationReason: "Curious about the new app" },
      ])),
    });
    expect(pt.topics[0].cited).toBe(true);
  });

  it("avisa si el idioma solo tiene clics del desplegable", async () => {
    const r = await reportTopicEvidence({
      language: "Polish",
      proposals: [{ label: "Family & Relatives", evidence: ["something"] }],
      prisma: fakePrisma(rows([{ targetLanguage: "Polish", motivation: "Work", learningGoal: null, applicationReason: null }])),
    });
    expect(r.evidenceWarnings.join("\n")).toContain("cero frases escritas");
  });
});

describe("assertTopicsGrounded", () => {
  it("NO tira por temas sin cita: avisa y devuelve el informe", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const r = await assertTopicsGrounded({ language: "French", city: { mode: "single", city: "Paris" }, proposals: EXPAT_FRENCH, prisma: fakePrisma() });
    expect(r.topics).toHaveLength(7);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("pista, no filtro"));
    vi.restoreAllMocks();
  });

  it("NO tira aunque el idioma no tenga ninguna frase escrita", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      assertTopicsGrounded({
        language: "Polish",
        city: { mode: "single", city: "Krakow" },
        proposals: [{ label: "Family & Relatives", slug: "family-and-relatives" }],
        prisma: fakePrisma(rows([{ targetLanguage: "Polish", motivation: "Work", learningGoal: null, applicationReason: null }])),
      }),
    ).resolves.toMatchObject({ corpusSize: 0 });
    vi.restoreAllMocks();
  });

  it("SIGUE tirando por las reglas de nombre, que no dependen de ningún beta", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = await assertTopicsGrounded({
      language: "French",
      city: { mode: "multi" },
      proposals: [
        { label: "Food And Drink", evidence: ["plan to move there in 6-8 months"] },
        { label: "Moving & Deadlines", slug: "moving", evidence: ["plan to move there in 6-8 months"] },
      ],
      prisma: fakePrisma(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain('"And"');
    expect(String(err.message)).toContain("no deriva del nombre");
    vi.restoreAllMocks();
  });
});

describe("la ciudad marco, antes que los temas", () => {
  const unTema = [{ label: "Family & Relatives", slug: "family-and-relatives" }];

  it("tira si no se declara ciudad: es una decision, no un olvido", async () => {
    const err = await assertTopicsGrounded({ language: "French", proposals: unTema, prisma: fakePrisma() }).catch((e) => e);
    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain("FALTA LA CIUDAD MARCO");
  });

  it("tira si la ciudad no esta aprobada, y dice cuales lo estan", async () => {
    const err = await assertTopicsGrounded({
      language: "French", city: { mode: "single", city: "Nantes" }, proposals: unTema, prisma: fakePrisma(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CityNotApprovedError);
    expect(String(err.message)).toContain("Nantes");
    expect(String(err.message)).toContain("Paris");
  });

  it("no tira antes de comprobar la ciudad: la ciudad se mira PRIMERO", async () => {
    // Nombre invalido ("And") Y ciudad invalida. Tiene que ganar la ciudad,
    // porque si la ciudad esta mal los siete temas sobran.
    const err = await assertTopicsGrounded({
      language: "French", city: { mode: "single", city: "Nantes" },
      proposals: [{ label: "Food And Drink" }], prisma: fakePrisma(),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(CityNotApprovedError);
  });

  it("acepta la gira y el sin-ciudad sin mirar la lista", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const city of [{ mode: "multi" } as const, { mode: "none" } as const]) {
      await expect(assertTopicsGrounded({ language: "French", city, proposals: unTema, prisma: fakePrisma() })).resolves.toBeTruthy();
    }
    vi.restoreAllMocks();
  });

  it("el idioma se busca sin distinguir mayusculas: la base guarda \"french\"", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(assertTopicsGrounded({
      language: "french", city: { mode: "single", city: "paris" }, proposals: unTema, prisma: fakePrisma(),
    })).resolves.toBeTruthy();
    vi.restoreAllMocks();
  });
});
