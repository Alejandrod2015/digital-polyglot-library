import type { LevelTestRung } from "@domain/levelTest";

/**
 * Stations of the Spanish listening level test, authored by hand on
 * 2026-09-20 against the live catalogue. Each one names a story and the
 * paragraphs (`audioFragments` indexes) that make the clip; the audio
 * URLs, the clip text and the vocabulary options are resolved from the
 * database when the API serves the test, so the clip always matches what
 * the reader plays and the gloss is the story's own gloss.
 *
 * The comprehension question is answered from the clip alone, in English,
 * with three options: one right, two that a learner who only caught a few
 * words would find plausible. `vocabWord` must be a `vocab[].word` of that
 * story and must appear in the clip.
 *
 * Two stations per rung, so two attempts rarely hear the same clips.
 * `scripts/checkLevelTestStations.ts` verifies every story is still live
 * with audio, every fragment index exists and every vocab word is in the
 * clip; run it before shipping a change here.
 */
export type AuthoredStation = {
  id: string;
  level: LevelTestRung;
  storySlug: string;
  fragments: number[];
  comprehension: { question: string; options: [string, string, string]; answerIndex: 0 | 1 | 2 };
  vocabWord: string;
};

export type AuthoredVariant = {
  ladder: LevelTestRung[];
  stations: AuthoredStation[];
};

const LATAM: AuthoredVariant = {
  ladder: ["A1", "A2", "B1", "B2", "C1"],
  stations: [
    {
      id: "es-latam-a1-nota-de-voz",
      level: "A1",
      storySlug: "una-nota-de-voz-en-getsemani",
      fragments: [2],
      comprehension: {
        question: "What does Jorge say in the voice note?",
        options: [
          "He is coming the week of the 15th and bringing his guitar.",
          "He cannot make it to the wedding this year.",
          "He wants Lucía to call her mother right away.",
        ],
        answerIndex: 0,
      },
      vocabWord: "altavoz",
    },
    {
      id: "es-latam-a1-favor-a-oscuras",
      level: "A1",
      storySlug: "un-favor-a-oscuras-en-barranquilla",
      fragments: [1, 2],
      comprehension: {
        question: "Why does Camilo knock on Alveiro's door?",
        options: [
          "To ask him to sign the building's list.",
          "The power is out and he needs a socket for his flashlight.",
          "To complain about noise from upstairs.",
        ],
        answerIndex: 1,
      },
      vocabWord: "enchufe",
    },
    {
      id: "es-latam-a2-fecha-mal-escrita",
      level: "A2",
      storySlug: "un-motivo-que-no-convence",
      fragments: [2, 3],
      comprehension: {
        question: "Why can't Percy cross today?",
        options: [
          "The canoe is not ready yet.",
          "The officer's shift has already ended.",
          "The date on his permit is written wrong.",
        ],
        answerIndex: 2,
      },
      vocabWord: "firme",
    },
    {
      id: "es-latam-a2-nadie-firma",
      level: "A2",
      storySlug: "el-que-si-puede-firmar",
      fragments: [2, 3],
      comprehension: {
        question: "What is Percy about to do when he turns and sees Karina?",
        options: [
          "Pay a man on the shore to fix his paper the quick way.",
          "Buy a ticket for the raft.",
          "Ask her to sign the permit herself.",
        ],
        answerIndex: 0,
      },
      vocabWord: "balde",
    },
    {
      id: "es-latam-b1-tinto",
      level: "B1",
      storySlug: "un-tinto-que-nadie-pidio",
      fragments: [3, 4, 5, 6],
      comprehension: {
        question: "What does Esteban think about taking the tables out?",
        options: [
          "It would make the cafe look newer.",
          "She should do it before December.",
          "She would lose the customers who sit for an hour over a coffee.",
        ],
        answerIndex: 2,
      },
      vocabWord: "letrero",
    },
    {
      id: "es-latam-b1-greca-fria",
      level: "B1",
      storySlug: "la-greca-fria",
      fragments: [3, 4, 5],
      comprehension: {
        question: "According to Esteban, what did Rocío do wrong?",
        options: [
          "She raised the price and put up the sign on the same day.",
          "She put the sign where nobody could see it.",
          "She kept the old price for too long.",
        ],
        answerIndex: 0,
      },
      vocabWord: "mitad",
    },
    {
      id: "es-latam-b2-otra-columna",
      level: "B2",
      storySlug: "la-otra-columna",
      fragments: [3],
      comprehension: {
        question: "How does Griselda defend her group?",
        options: [
          "Her students score higher than the app groups.",
          "Her students come after work and never miss a class.",
          "She promises to add a review module on Fridays.",
        ],
        answerIndex: 1,
      },
      vocabWord: "laburo",
    },
    {
      id: "es-latam-b2-buena-idea-ariel",
      level: "B2",
      storySlug: "que-buena-idea-ariel",
      fragments: [4, 5],
      comprehension: {
        question: "How does Ariel bring the story hour back?",
        options: [
          "He apologises to Griselda in front of the students.",
          "He asks the students to vote on it.",
          "He presents it as his own idea: a weekly reading hour.",
        ],
        answerIndex: 2,
      },
      vocabWord: "de espaldas",
    },
    {
      id: "es-latam-c1-visaje",
      level: "C1",
      storySlug: "marina-llega-con-visaje",
      fragments: [4, 5],
      comprehension: {
        question: "Why does Valeria stop Marina's story?",
        options: [
          "She has already heard it from a neighbour.",
          "The man in the gossip is her cousin and the party was at her house.",
          "Julián is getting bored and wants to leave.",
        ],
        answerIndex: 1,
      },
      vocabWord: "sofocón",
    },
    {
      id: "es-latam-c1-lengua-de-julian",
      level: "C1",
      storySlug: "la-lengua-de-julian",
      fragments: [5, 6],
      comprehension: {
        question: "What does Marina reveal when Julián confesses?",
        options: [
          "The secret was invented to test whether he could keep it.",
          "She had already forgiven him days ago.",
          "The whole group had agreed to keep him quiet.",
        ],
        answerIndex: 0,
      },
      vocabWord: "con el corazón en la mano",
    },
  ],
};

const SPAIN: AuthoredVariant = {
  ladder: ["A1", "A2", "B1", "B2"],
  stations: [
    {
      id: "es-spain-a1-la-barra-manda",
      level: "A1",
      storySlug: "la-barra-manda",
      fragments: [2, 3],
      comprehension: {
        question: "Why doesn't Irene get a menu?",
        options: [
          "The kitchen has closed for the night.",
          "In this bar there is no menu: you order at the counter.",
          "The owner did not hear her.",
        ],
        answerIndex: 1,
      },
      vocabWord: "carta",
    },
    {
      id: "es-spain-a1-esa-tapa",
      level: "A1",
      storySlug: "nadie-ha-pedido-esa-tapa",
      fragments: [3],
      comprehension: {
        question: "Why does Irene get a plate she did not order?",
        options: [
          "Here a beer always comes with some food.",
          "The owner mixed up her order with another one.",
          "The man with the newspaper sent it over.",
        ],
        answerIndex: 0,
      },
      vocabWord: "tuyo",
    },
    {
      id: "es-spain-a2-dos-dedos",
      level: "A2",
      storySlug: "dos-dedos-no-son-dos",
      fragments: [2],
      comprehension: {
        question: "What does Quique teach Irene?",
        options: [
          "Squid is ordered by weight, not by pieces.",
          "She should say the number out loud instead of using her hands.",
          "Here you start counting on a different finger, and depth is shown with the hands.",
        ],
        answerIndex: 2,
      },
      vocabWord: "hondo",
    },
    {
      id: "es-spain-a2-toca-el-brazo",
      level: "A2",
      storySlug: "quien-toca-el-brazo-avisa",
      fragments: [4],
      comprehension: {
        question: "Why does Rocío touch Irene's arm when she talks about the flat?",
        options: [
          "She wants Irene to speak more quietly.",
          "Someone else in the building wants that flat too.",
          "She is warning her that the rent will go up.",
        ],
        answerIndex: 1,
      },
      vocabWord: "en serio",
    },
    {
      id: "es-spain-b1-tejado",
      level: "B1",
      storySlug: "el-tejado-a-la-mitad",
      fragments: [2, 3, 4],
      comprehension: {
        question: "Why is the other company's estimate cheaper?",
        options: [
          "It only covers half the roof, not the whole thing.",
          "They use cheaper bricks and cement.",
          "They give a discount for paying in cash.",
        ],
        answerIndex: 0,
      },
      vocabWord: "así de simple",
    },
    {
      id: "es-spain-b1-rebaja-en-mano",
      level: "B1",
      storySlug: "la-rebaja-en-mano",
      fragments: [3, 4],
      comprehension: {
        question: "Why does Celia turn down the cheaper deal?",
        options: [
          "She thinks the work would take too long.",
          "She would rather hire Toño's company.",
          "The money belongs to three neighbours and she must be able to show them what she signs.",
        ],
        answerIndex: 2,
      },
      vocabWord: "rechazar",
    },
    {
      id: "es-spain-b2-vuelva-cuando-quiera",
      level: "B2",
      storySlug: "vuelva-cuando-quiera",
      fragments: [3, 4],
      comprehension: {
        question: "What stops Claudia at the box of books?",
        options: [
          "The books carry her club's crest stamped inside the cover.",
          "The bookseller says they are not for sale.",
          "They are the novels she came in looking for.",
        ],
        answerIndex: 0,
      },
      vocabWord: "guarda",
    },
    {
      id: "es-spain-b2-tomo-aparte",
      level: "B2",
      storySlug: "el-tomo-aparte",
      fragments: [1, 2],
      comprehension: {
        question: "On what condition will Martina sell the books?",
        options: [
          "Only if the club pays the full price at once.",
          "Only if they go back on display where people can see them.",
          "Only if they stay in her shop until the new premises open.",
        ],
        answerIndex: 1,
      },
      vocabWord: "con cara de",
    },
  ],
};

/**
 * Variant keys as the mobile app sends them: the onboarding picker uses
 * "es" for Spain and "latam" for the Americas (`variantCode` in
 * OnboardingFlow), preferences may carry "spain". The LATAM pool covers
 * every American variant (mexico, colombia, argentina, chile) because the
 * test measures listening at a level, not the accent of one country.
 */
export function spanishStationsForVariant(variant: string | null | undefined): AuthoredVariant {
  const key = (variant ?? "").trim().toLowerCase();
  return key === "spain" || key === "es" ? SPAIN : LATAM;
}

export const SPANISH_LEVEL_TEST = { latam: LATAM, spain: SPAIN } as const;
