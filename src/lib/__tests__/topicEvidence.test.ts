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
  it("rechaza los siete temas del Expat francés respaldados por el desplegable", async () => {
    const err = await assertTopicsGrounded({
      language: "French",
      proposals: EXPAT_FRENCH,
      prisma: fakePrisma(),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TopicEvidenceError);
    // Los siete, no uno: ninguno se sostiene con un clic.
    for (const p of EXPAT_FRENCH) expect(String(err.message)).toContain(`"${p.label}"`);
    expect(String(err.message)).toContain("demasiado cortas");
  });

  it("rechaza el valor enlatado aunque el idioma tenga texto libre al lado", async () => {
    const err = await assertTopicsGrounded({
      language: "French",
      proposals: [{ label: "Family & Relatives", evidence: ["family connection"] }],
      prisma: fakePrisma([
        { targetLanguage: "French", motivation: "Family connection", learningGoal: null, applicationReason: "To try new ways to learn" },
      ]),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain('"Family & Relatives"');
  });

  it("rechaza una cita larga que nadie escribió", async () => {
    const err = await assertTopicsGrounded({
      language: "French",
      proposals: [{ label: "Houses & Mortgages", evidence: ["buying a house in Lyon next year"] }],
      prisma: fakePrisma(),
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TopicEvidenceError);
    expect(String(err.message)).toContain("nadie escribió");
  });

  it("cuenta las frases ESCRITAS, no las filas, cuando falla", async () => {
    const err = await assertTopicsGrounded({
      language: "French",
      proposals: [{ label: "Phone & Internet", evidence: ["move abroad"] }],
      prisma: fakePrisma(),
    }).catch((e) => e);

    // 2 clics + 2 applicationReason: cero motivaciones escritas.
    expect(String(err.message)).toContain("Hay 0 frases de learningGoal y 2 applicationReason");
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
