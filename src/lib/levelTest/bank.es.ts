import type { LevelTestRung } from "@domain/levelTest";

/**
 * The Spanish level test bank (2026-09-20): exercises written FOR the test,
 * one bank for every variant. Neutral Spanish, no slang, no regionalisms,
 * no characters from the stories. The level of each word is the project's
 * external ruler (`src/lib/cefr/spanish*.ts`, Cervantes-based lemma lists),
 * checked by `scripts/checkLevelTestBank.ts`; the sentences are written so
 * the word can be understood from them, without any story.
 *
 * Every station has ONE exercise of each practice format the learner keeps
 * using afterwards (user, 2026-09-20: "uno de cada tipo"):
 *  - `listen` (listen_choose): a sentence is played and picked among four
 *    look-alike sentences, each with its English gloss;
 *  - `meaning` (meaning_in_context): the word is shown (and heard) and the
 *    learner picks its English meaning among four glosses;
 *  - `fill` (fill_blank): a sentence with a gap and four Spanish words;
 *  - `match` (match_meaning): four words matched to their English meaning.
 *
 * The audio is the test's own (`bank.es.audio.json`, rendered by
 * `scripts/_genLevelTestClips.ts` in the practice voice): sentence clips
 * for listen and fill, word clips for meaning and match. When a clip is
 * missing the app falls back to runtime TTS, as it does in practice.
 *
 * Two stations per rung; the app picks one per rung at random.
 */
export type BankListenItem = {
  /** The sentence that is played; also the first option. */
  sentence: string;
  /** Four sentences, the answer first; they differ in one or two words. */
  options: [string, string, string, string];
  translations: [string, string, string, string];
};

export type BankMeaningItem = {
  word: string;
  /** Contains the word (in the form it takes) inside `[[...]]`. */
  sentence: string;
  /** Four English glosses, the answer first. */
  options: [string, string, string, string];
};

export type BankFillItem = {
  /** The full sentence, with the answer inside `[[...]]`. */
  sentence: string;
  /** Four Spanish words, the answer first. */
  options: [string, string, string, string];
  translation: string;
  optionTranslations: [string, string, string, string];
};

export type BankMatchItem = {
  pairs: [BankPair, BankPair, BankPair, BankPair];
};

export type BankPair = { word: string; meaning: string };

export type BankStation = {
  listen: BankListenItem;
  meaning: BankMeaningItem;
  fill: BankFillItem;
  match: BankMatchItem;
};

export const SPANISH_LEVEL_TEST_BANK: Record<LevelTestRung, BankStation[]> = {
  A1: [
    {
      listen: {
        sentence: "Mi hermano trabaja en un hospital.",
        options: [
          "Mi hermano trabaja en un hospital.",
          "Mi hermano trabaja en un hotel.",
          "Mi hermana trabaja en un hospital.",
          "Mi hermano vive en un hospital.",
        ],
        translations: [
          "My brother works in a hospital.",
          "My brother works in a hotel.",
          "My sister works in a hospital.",
          "My brother lives in a hospital.",
        ],
      },
      meaning: {
        word: "abrir",
        sentence: "Voy a [[abrir]] la ventana porque hace calor.",
        options: ["to open", "to close", "to clean", "to paint"],
      },
      fill: {
        sentence: "Por la mañana [[tomo]] café con leche.",
        options: ["tomo", "duermo", "escribo", "cierro"],
        translation: "In the morning I _____ coffee with milk.",
        optionTranslations: ["have (drink)", "sleep", "write", "close"],
      },
      match: {
        pairs: [
          { word: "casa", meaning: "house" },
          { word: "agua", meaning: "water" },
          { word: "libro", meaning: "book" },
          { word: "mesa", meaning: "table" },
        ],
      },
    },
    {
      listen: {
        sentence: "La tienda cierra a las ocho.",
        options: [
          "La tienda cierra a las ocho.",
          "La tienda abre a las ocho.",
          "La tienda cierra a las dos.",
          "La escuela cierra a las ocho.",
        ],
        translations: [
          "The shop closes at eight.",
          "The shop opens at eight.",
          "The shop closes at two.",
          "The school closes at eight.",
        ],
      },
      meaning: {
        word: "tarde",
        sentence: "Hoy llego [[tarde]] al trabajo porque el autobús no viene.",
        options: ["late", "early", "tired", "alone"],
      },
      fill: {
        sentence: "Tengo hambre; quiero [[comer]] algo.",
        options: ["comer", "leer", "dormir", "cantar"],
        translation: "I'm hungry; I want _____ something.",
        optionTranslations: ["to eat", "to read", "to sleep", "to sing"],
      },
      match: {
        pairs: [
          { word: "coche", meaning: "car" },
          { word: "ventana", meaning: "window" },
          { word: "amigo", meaning: "friend" },
          { word: "leche", meaning: "milk" },
        ],
      },
    },
  ],
  A2: [
    {
      listen: {
        sentence: "Ayer fuimos al cine con unos amigos.",
        options: [
          "Ayer fuimos al cine con unos amigos.",
          "Ayer fuimos al parque con unos amigos.",
          "Ayer fuimos al cine con unos primos.",
          "Hoy vamos al cine con unos amigos.",
        ],
        translations: [
          "Yesterday we went to the cinema with some friends.",
          "Yesterday we went to the park with some friends.",
          "Yesterday we went to the cinema with some cousins.",
          "Today we're going to the cinema with some friends.",
        ],
      },
      meaning: {
        word: "cansado",
        sentence: "Estoy muy [[cansado]] porque dormí solo tres horas.",
        options: ["tired", "happy", "hungry", "lost"],
      },
      fill: {
        sentence: "No encuentro las llaves; creo que las [[dejé]] en casa.",
        options: ["dejé", "bebí", "pinté", "rompí"],
        translation: "I can't find the keys; I think I _____ them at home.",
        optionTranslations: ["left", "drank", "painted", "broke"],
      },
      match: {
        pairs: [
          { word: "viaje", meaning: "trip" },
          { word: "regalo", meaning: "gift" },
          { word: "cuchara", meaning: "spoon" },
          { word: "playa", meaning: "beach" },
        ],
      },
    },
    {
      listen: {
        sentence: "Voy a llamar al médico esta tarde.",
        options: [
          "Voy a llamar al médico esta tarde.",
          "Voy a llamar a mi madre esta tarde.",
          "Voy a visitar al médico esta tarde.",
          "Voy a llamar al médico esta noche.",
        ],
        translations: [
          "I'm going to call the doctor this afternoon.",
          "I'm going to call my mother this afternoon.",
          "I'm going to visit the doctor this afternoon.",
          "I'm going to call the doctor tonight.",
        ],
      },
      meaning: {
        word: "esperar",
        sentence: "Tienes que [[esperar]] diez minutos; el médico está ocupado.",
        options: ["to wait", "to pay", "to leave", "to call"],
      },
      fill: {
        sentence: "El tren sale a las nueve, así que tenemos que [[levantarnos]] temprano.",
        options: ["levantarnos", "sentarnos", "perdernos", "callarnos"],
        translation: "The train leaves at nine, so we have _____ early.",
        optionTranslations: ["to get up", "to sit down", "to get lost", "to keep quiet"],
      },
      match: {
        pairs: [
          { word: "alquilar", meaning: "to rent" },
          { word: "todavía", meaning: "still, yet" },
          { word: "aunque", meaning: "although" },
          { word: "acordarse", meaning: "to remember" },
        ],
      },
    },
  ],
  B1: [
    {
      listen: {
        sentence: "Aunque llovía, decidimos salir a caminar.",
        options: [
          "Aunque llovía, decidimos salir a caminar.",
          "Aunque nevaba, decidimos salir a caminar.",
          "Aunque llovía, decidimos quedarnos en casa.",
          "Como llovía, decidimos salir a correr.",
        ],
        translations: [
          "Although it was raining, we decided to go out for a walk.",
          "Although it was snowing, we decided to go out for a walk.",
          "Although it was raining, we decided to stay home.",
          "As it was raining, we decided to go out for a run.",
        ],
      },
      meaning: {
        word: "evitar",
        sentence: "Prefiero [[evitar]] el centro a esa hora porque hay mucho tráfico.",
        options: ["to avoid", "to visit", "to cross", "to enjoy"],
      },
      fill: {
        sentence: "Si tuviera más tiempo, [[aprendería]] a tocar la guitarra.",
        options: ["aprendería", "aprendí", "aprendo", "aprenderé"],
        translation: "If I had more time, I _____ to play the guitar.",
        optionTranslations: ["would learn", "learned", "learn", "will learn"],
      },
      match: {
        pairs: [
          { word: "plazo", meaning: "deadline, term" },
          { word: "apoyo", meaning: "support" },
          { word: "madrugar", meaning: "to get up early" },
          { word: "derrotar", meaning: "to defeat" },
        ],
      },
    },
    {
      listen: {
        sentence: "Me preocupa que no hayan llegado todavía.",
        options: [
          "Me preocupa que no hayan llegado todavía.",
          "Me alegra que hayan llegado ya.",
          "Me preocupa que no hayan llamado todavía.",
          "Me sorprende que no hayan llegado todavía.",
        ],
        translations: [
          "It worries me that they haven't arrived yet.",
          "I'm glad they have already arrived.",
          "It worries me that they haven't called yet.",
          "It surprises me that they haven't arrived yet.",
        ],
      },
      meaning: {
        word: "escaso",
        sentence: "El agua es [[escasa]] en esta región durante el verano.",
        options: ["scarce", "cold", "dirty", "expensive"],
      },
      fill: {
        sentence: "Cuando [[llegue]] a casa, te llamo.",
        options: ["llegue", "llego", "llegaré", "llegaba"],
        translation: "When I _____ home, I'll call you.",
        optionTranslations: ["get (subjunctive)", "get (present)", "will get", "was getting"],
      },
      match: {
        pairs: [
          { word: "preocupación", meaning: "worry" },
          { word: "averiguar", meaning: "to find out" },
          { word: "sequía", meaning: "drought" },
          { word: "orgullo", meaning: "pride" },
        ],
      },
    },
  ],
  B2: [
    {
      listen: {
        sentence: "De haberlo sabido, habríamos llegado antes.",
        options: [
          "De haberlo sabido, habríamos llegado antes.",
          "De haberlo sabido, habríamos salido antes.",
          "De haberlo visto, habríamos llegado antes.",
          "Si lo hubiéramos sabido, habríamos llegado tarde.",
        ],
        translations: [
          "Had we known, we would have arrived earlier.",
          "Had we known, we would have left earlier.",
          "Had we seen it, we would have arrived earlier.",
          "If we had known, we would have arrived late.",
        ],
      },
      meaning: {
        word: "padecer",
        sentence: "Mi abuelo [[padece]] una enfermedad del corazón desde hace años.",
        options: ["to suffer from", "to cure", "to fear", "to hide"],
      },
      fill: {
        sentence: "Ojalá me [[hubieras]] avisado antes; ahora es tarde.",
        options: ["hubieras", "habías", "habrás", "hayas"],
        translation: "I wish you _____ warned me earlier; now it's too late.",
        optionTranslations: ["had (past subjunctive)", "had (indicative)", "will have", "have (present subjunctive)"],
      },
      match: {
        pairs: [
          { word: "rubor", meaning: "blush" },
          { word: "luto", meaning: "mourning" },
          { word: "sesgo", meaning: "bias" },
          { word: "muchedumbre", meaning: "crowd" },
        ],
      },
    },
    {
      listen: {
        sentence: "Por mucho que insistas, no cambiaré de opinión.",
        options: [
          "Por mucho que insistas, no cambiaré de opinión.",
          "Por mucho que insistas, no cambiaré de planes.",
          "Por poco que insistas, cambiaré de opinión.",
          "Aunque insistas, no cambiaré de opinión.",
        ],
        translations: [
          "However much you insist, I won't change my mind.",
          "However much you insist, I won't change my plans.",
          "However little you insist, I will change my mind.",
          "Even if you insist, I won't change my mind.",
        ],
      },
      meaning: {
        word: "regatear",
        sentence: "En ese mercado es normal [[regatear]] el precio.",
        options: ["to haggle", "to double", "to hide", "to forget"],
      },
      fill: {
        sentence: "El proyecto fracasó [[debido a]] la falta de presupuesto.",
        options: ["debido a", "a pesar de", "en lugar de", "con tal de"],
        translation: "The project failed _____ the lack of budget.",
        optionTranslations: ["due to", "in spite of", "instead of", "provided that"],
      },
      match: {
        pairs: [
          { word: "destrozar", meaning: "to wreck" },
          { word: "hallazgo", meaning: "finding, discovery" },
          { word: "amenaza", meaning: "threat" },
          { word: "recelo", meaning: "suspicion, wariness" },
        ],
      },
    },
  ],
  C1: [
    {
      listen: {
        sentence: "Cabe señalar que el informe carece de datos fiables.",
        options: [
          "Cabe señalar que el informe carece de datos fiables.",
          "Cabe señalar que el informe carece de datos recientes.",
          "Cabe destacar que el informe abunda en datos fiables.",
          "Conviene señalar que el informe carece de fuentes fiables.",
        ],
        translations: [
          "It should be noted that the report lacks reliable data.",
          "It should be noted that the report lacks recent data.",
          "It is worth highlighting that the report abounds in reliable data.",
          "It is advisable to note that the report lacks reliable sources.",
        ],
      },
      meaning: {
        word: "acuciar",
        sentence: "La falta de agua [[acucia]] a los agricultores de la zona.",
        options: ["to press hard", "to reassure", "to reward", "to entertain"],
      },
      fill: {
        sentence: "[[Por más]] que se esforzó, no logró convencerlos.",
        options: ["Por más", "A pesar", "Con tal", "En cuanto"],
        translation: "_____ he tried, he did not manage to convince them.",
        optionTranslations: ["however hard", "in spite (incomplete)", "provided (incomplete)", "as soon as"],
      },
      match: {
        pairs: [
          { word: "estallido", meaning: "outburst" },
          { word: "tregua", meaning: "truce" },
          { word: "ameno", meaning: "pleasant" },
          { word: "esbozo", meaning: "sketch, outline" },
        ],
      },
    },
    {
      listen: {
        sentence: "De no mediar un acuerdo, la huelga seguirá adelante.",
        options: [
          "De no mediar un acuerdo, la huelga seguirá adelante.",
          "De no mediar un acuerdo, la huelga quedará suspendida.",
          "De haber un acuerdo, la huelga seguirá adelante.",
          "Si no media un acuerdo, la huelga seguirá adelante.",
        ],
        translations: [
          "Unless an agreement is reached, the strike will go ahead.",
          "Unless an agreement is reached, the strike will be suspended.",
          "If there is an agreement, the strike will go ahead.",
          "If no agreement is reached, the strike will go ahead.",
        ],
      },
      meaning: {
        word: "defraudar",
        sentence: "La película me [[defraudó]]: esperaba mucho más.",
        options: ["to disappoint", "to thrill", "to frighten", "to bore"],
      },
      fill: {
        sentence: "Las negociaciones se han [[estancado]] por desacuerdos de última hora.",
        options: ["estancado", "callado", "madrugado", "bostezado"],
        translation: "The negotiations have _____ over last-minute disagreements.",
        optionTranslations: ["stalled", "gone quiet", "got up early", "yawned"],
      },
      match: {
        pairs: [
          { word: "naufragar", meaning: "to founder, to fail" },
          { word: "vacilante", meaning: "hesitant" },
          { word: "desliz", meaning: "slip, lapse" },
          { word: "desdén", meaning: "disdain" },
        ],
      },
    },
  ],
};
