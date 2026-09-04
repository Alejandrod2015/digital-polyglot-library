import { describe, it, expect, vi } from "vitest";
import { assertTopicsGrounded, TopicEvidenceError, type TopicProposal } from "../topicEvidence";
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

describe("assertTopicsGrounded", () => {
  /**
   * Desde el 2026-09-04 la falta de cita AVISA, no bloquea (decision del
   * usuario: el porton "estorba; tendria que alimentar a la recomendacion pero
   * no puede ser tan dura"). Lo que se comprueba aqui es que el aviso siga
   * NOMBRANDO el tema flojo, que es para lo que existe: sin el, un tema sacado
   * del molde de un curso pasa sin que nadie se entere.
   */
  function capturaConsola() {
    const lineas: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      lineas.push(a.map(String).join(" "));
    });
    return { lineas, restore: () => spy.mockRestore() };
  }

  it("avisa, sin tirar, de los siete temas del Expat frances respaldados por el desplegable", async () => {
    const { lineas, restore } = capturaConsola();
    await expect(
      assertTopicsGrounded({ language: "French", proposals: EXPAT_FRENCH, prisma: fakePrisma() }),
    ).resolves.toBeUndefined();
    restore();

    const salida = lineas.join("\n");
    // Los siete, no uno: ninguno se sostiene con un clic.
    for (const p of EXPAT_FRENCH) expect(salida).toContain(`"${p.label}"`);
    expect(salida).toContain("demasiado cortas");
    expect(salida).toContain("No bloquea");
  });

  it("avisa del valor enlatado aunque el idioma tenga texto libre al lado", async () => {
    const { lineas, restore } = capturaConsola();
    await expect(
      assertTopicsGrounded({
        language: "French",
        proposals: [{ label: "Family & Relatives", evidence: ["family connection"] }],
        prisma: fakePrisma([
          { targetLanguage: "French", motivation: "Family connection", learningGoal: null, applicationReason: "To try new ways to learn" },
        ]),
      }),
    ).resolves.toBeUndefined();
    restore();

    expect(lineas.join("\n")).toContain('"Family & Relatives"');
  });

  it("avisa de una cita larga que nadie escribio", async () => {
    const { lineas, restore } = capturaConsola();
    await expect(
      assertTopicsGrounded({
        language: "French",
        proposals: [{ label: "Houses & Mortgages", evidence: ["buying a house in Lyon next year"] }],
        prisma: fakePrisma(),
      }),
    ).resolves.toBeUndefined();
    restore();

    expect(lineas.join("\n")).toContain("nadie escribió");
  });

  it("cuenta las frases ESCRITAS, no las filas, en el aviso", async () => {
    const { lineas, restore } = capturaConsola();
    await assertTopicsGrounded({
      language: "French",
      proposals: [{ label: "Phone & Internet", evidence: ["move abroad"] }],
      prisma: fakePrisma(),
    });
    restore();

    // 2 clics + 2 applicationReason: cero motivaciones escritas.
    expect(lineas.join("\n")).toContain("Hay 0 frases de learningGoal y 2 applicationReason");
  });

  it("SIGUE tirando cuando el nombre del tema rompe las reglas", async () => {
    const err = await assertTopicsGrounded({
      language: "French",
      proposals: [{ label: "Moving And Deadlines", slug: "moving-and-deadlines", evidence: ["plan to move there in 6-8 months"] }],
      prisma: fakePrisma(),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain("NOMBRES DE TEMA INVALIDOS");
    expect(String(err.message)).toContain('usa "And" en vez de "&"');
  });

  it("acepta temas citando texto libre de verdad", async () => {
    await expect(
      assertTopicsGrounded({
        language: "French",
        proposals: [
          { label: "Moving & Deadlines", slug: "moving-and-deadlines", evidence: ["plan to move there in 6-8 months"] },
          { label: "Apps & Learning", slug: "apps-and-learning", evidence: ["development of a useful app"] },
        ],
        prisma: fakePrisma(),
      }),
    ).resolves.toBeUndefined();
  });

  it("acepta la motivación escrita a mano por la opción Other", async () => {
    await expect(
      assertTopicsGrounded({
        language: "Spanish",
        proposals: [
          { label: "Neighbours & Favours", slug: "neighbours-and-favours", evidence: ["wish to talk to neighbours"] },
        ],
        prisma: fakePrisma(),
      }),
    ).resolves.toBeUndefined();
  });

  it("acepta una cita de learningGoal, que es la línea escrita del formulario", async () => {
    await expect(
      assertTopicsGrounded({
        language: "Portuguese",
        proposals: [
          { label: "Markets & Fruit", slug: "markets-and-fruit", evidence: ["buy fruit at the market"] },
        ],
        prisma: fakePrisma([
          {
            targetLanguage: "Portuguese",
            motivation: "Travel",
            learningGoal: "I want to buy fruit at the market without pointing",
            applicationReason: "Curious about the new app",
          },
        ]),
      }),
    ).resolves.toBeUndefined();
  });

  it("tira si el idioma solo tiene clics del desplegable", async () => {
    const err = await assertTopicsGrounded({
      language: "Polish",
      proposals: [{ label: "Family & Relatives", evidence: ["something"] }],
      prisma: fakePrisma([{ targetLanguage: "Polish", motivation: "Work", learningGoal: null, applicationReason: null }]),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain("Cero frases escritas");
  });
});
