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
      id: "es-latam-a1-pileta",
      level: "A1",
      storySlug: "pablo-explica-el-bondi",
      fragments: [4],
      comprehension: {
        question: "What does Pablo say about the word \"piscina\"?",
        options: [
          "People understand it, but nobody here says it.",
          "It is the only word people in Buenos Aires use for it.",
          "It means something else here, so she should not say it.",
        ],
        answerIndex: 0,
      },
      vocabWord: "lápiz",
    },
    {
      id: "es-latam-a1-sello",
      level: "A1",
      storySlug: "otro-sello-para-corrientes",
      fragments: [4],
      comprehension: {
        question: "What rule does the clerk explain?",
        options: [
          "The service is free, but only in the morning.",
          "First the stamp, and only then the service.",
          "The stamp takes an hour, so he should wait outside.",
        ],
        answerIndex: 1,
      },
      vocabWord: "sello",
    },
    {
      id: "es-latam-a2-fecha-mal-escrita",
      level: "A2",
      storySlug: "un-motivo-que-no-convence",
      fragments: [2, 3],
      comprehension: {
        question: "Why can't Percy cross today?",
        options: [
          "The canoe is not tied up in the right place.",
          "The officer's shift ended before he arrived.",
          "The date written on his permit is wrong.",
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
          "Pay a man on the shore to fix his paper the fast way.",
          "Buy a raft ticket in somebody else's name.",
          "Ask Karina to sign the permit even though she is off duty.",
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
          "It would make the cafe look newer and bring in younger people.",
          "She should do it, but only after December when it is quieter.",
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
          "She put the sign where the regular customers cannot see it.",
          "She kept the old price too long and now the sign is useless.",
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
          "Her students score higher than the app groups on the tests.",
          "Her students come after work and never miss a single class.",
          "She promises to add a review module to the Friday schedule.",
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
          "He apologises to Griselda in front of her six students.",
          "He asks the night students to vote on a weekly reading hour.",
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
          "She has already heard it from a neighbour in the building.",
          "The man in the gossip is her cousin and the party was at her house.",
          "Julián is bored, and she wants to hear the ending from him instead.",
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
          "The secret was invented on purpose to test whether he could keep it.",
          "She had already forgiven him days ago, before he called her.",
          "The whole group had agreed to keep him quiet at the party.",
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
          "The kitchen closed for the night a few minutes ago.",
          "In this bar there is no menu: you order at the counter.",
          "The owner did not hear her over the noise of the bar.",
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
          "Here a beer always comes with some food on the side.",
          "The owner mixed up her order with another customer's.",
          "The man with the newspaper sent it over to her table.",
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
          "At the fish stall squid is sold by weight, never by pieces.",
          "She should say the number out loud instead of using her hands.",
          "You count from a different finger, and depth is shown by hand.",
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
          "She wants Irene to speak more quietly in the queue.",
          "Someone else in the building wants that flat too.",
          "She is warning her that the rent goes up in winter.",
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
          "They use cheaper bricks and cement than Toño does.",
          "They give a discount when the work is paid in cash.",
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
          "She thinks a job that starts next week will be rushed and done badly.",
          "She would rather hire Toño, whose estimate covers the whole roof.",
          "The money is the three neighbours' and they must see what she signs.",
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
          "The bookseller tells her the whole box is not for sale.",
          "They are the very novels she came into the shop looking for.",
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
          "Only if the club pays the full price at once, in cash.",
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
