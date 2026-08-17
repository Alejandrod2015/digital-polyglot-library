// /src/lib/talkingPoints.ts
//
// The Talking Points catalogue: short non-fiction in the target language about
// what people in that country are actually arguing about.
//
// Three things this file is the source of truth for, and each exists because
// getting it wrong is silent:
//
//   1. WHO CAN OPEN IT; `canAccessTalkingPoints`, polyglot and owner only.
//      Both routes call it; hiding a nav link is not a gate.
//   2. VOCABULARY DENSITY; ten entries per hundred words, the journey figure.
//      Below that a piece stops teaching and is just an article.
//   3. SURFACE FORMS; every entry must occur in the body exactly as the
//      highlighter will look for it, or it silently highlights nothing.
//
// (2) and (3) are enforced by `scripts/_tpGateTest.ts`, not by good intentions.
//
// Content lives here as a typed literal. It belongs in Prisma with a Studio
// authoring surface; that migration has not happened yet.

import type { Plan } from "@domain/access";
import type { TalkingPhoto } from "@/lib/wikimediaCommons";
import warumKeineKarteTimings from "@/data/talkingPoints/warum-keine-karte.timings.json";

/**
 * Who can open Talking Points.
 *
 * Polyglot (and owner) only, like `/create`. The nav entry is hidden for
 * everyone else, but hiding a link is not a gate; every route calls this too.
 *
 * The development escape exists so the prototype is openable in a worktree
 * that has no Clerk keys and therefore no session at all. It can never fire in
 * production: NODE_ENV is "production" there, and a deployed app always has a
 * publishable key.
 */
export function canAccessTalkingPoints(plan: Plan): boolean {
  if (plan === "polyglot" || plan === "owner") return true;
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
}

export type CategoryId =
  | "money-work"
  | "city-housing"
  | "food-table"
  | "language-speech"
  | "tech-internet"
  | "body-health"
  | "nature-climate";

export type TalkingCategory = {
  id: CategoryId;
  /** Shown on the filter chip. UI is English. */
  label: string;
};

// Interest domains, not lexical domains. A journey topic is named after the
// vocabulary it teaches ("Food & Everyday Life"); these are named after what
// somebody actually wants to know about. The lexical payoff still has to be
// there, but it is not what makes a person tap.
export const TALKING_CATEGORIES: TalkingCategory[] = [
  { id: "city-housing", label: "City & Housing" },
  { id: "money-work", label: "Money & Work" },
  { id: "food-table", label: "Food & The Table" },
  { id: "language-speech", label: "Language & How People Talk" },
  { id: "tech-internet", label: "Tech & The Internet" },
  { id: "body-health", label: "Body & Health" },
  { id: "nature-climate", label: "Nature & Climate" },
];

export type TalkingSource = {
  id: string;
  /** The institution. Never a newspaper. */
  org: string;
  title: string;
  url: string;
  /** What this source actually supports, in one line. */
  supports: string;
  /** ISO date a human last checked it. */
  checkedAt: string;
  /** Set when the figure still needs confirming against the primary tables. */
  needsVerification?: boolean;
};

export type TalkingVocab = {
  /** Dictionary form, shown in the word list. */
  term: string;
  /**
   * The form as it literally appears in the body, when it differs from `term`.
   * `StoryContent` highlights by surface match, so without this an infinitive
   * or an article-carrying entry silently fails to highlight: "apretar" never
   * matches "te aprieta". Same contract the journey stories use.
   */
  surface?: string;
  type: string;
  /**
   * Register, when the entry is not plain neutral prose. Same vocabulary the
   * journey stories use; `colloquial`, `slang`, `regional`, `vulgar`; and
   * the reason it matters is that a learner who cannot tell "el Kiez" from
   * "la vivienda" will use one of them in the wrong room.
   */
  register?: "neutral" | "colloquial" | "slang" | "regional" | "vulgar";
  /**
   * A DEFINITION in English, not a translation. "to rent" tells a reader who
   * already knows the word that they were right; "to pay to live in a home you
   * do not own" teaches the one who did not. Journey stories set this bar and
   * this section is held to it.
   */
  en: string;
};

/**
 * Three pieces sit under one topic, so they must not be three takes on the
 * same thing. One angle each, enforced by the type.
 */
export type PieceAngle = "explainer" | "debate" | "portrait";

export type TalkingPiece = {
  slug: string;
  /** The title, in the target language. */
  title: string;
  /** One line of English framing for the card. */
  hook: string;
  angle: PieceAngle;
  /** Empty while unwritten; the reader then shows an honest empty state. */
  body: string[];
  vocab: TalkingVocab[];
  sources: TalkingSource[];
  /**
   * Word-level timings from aeneas forced alignment, for karaoke. Absent until
   * a piece has been aligned. Note this needs no transcription API: aeneas
   * aligns the text we already have against the audio.
   */
  audioWordTimings?: unknown;
  /**
   * Rendered narration, uploaded to media storage. Absent until a piece has
   * been through the audio pipeline; the reader falls back to a notice.
   */
  audioUrl?: string;
  /**
   * Optional photo from Wikimedia Commons. Optional because a piece publishes
   * on its prose and its sources; a picture it cannot credit is a picture it
   * does not get.
   */
  photo?: TalkingPhoto;
};

export type TalkingTopic = {
  slug: string;
  /** Topic banner title. English, like every journey topic label. */
  label: string;
  categoryId: CategoryId;
  /** ISO 3166-1 alpha-2, drives the flag and the voice country. */
  country: string;
  language: string;
  /**
   * CEFR code, per topic rather than per section: non-fiction difficulty
   * follows the subject, and the catalogue already spans languages the reader
   * is at different levels in. The reader used to hardcode "b2".
   */
  level: string;
  /** One line under the label in the picker. */
  blurb: string;
  pieces: TalkingPiece[];
};

const CHECKED = "2026-08-05";

const SRC_BDE: TalkingSource = {
  id: "bde-2025",
  org: "Banco de España",
  title: "El mercado del alquiler de vivienda residencial en España",
  url: "https://www.bde.es/wbe/en/publicaciones/analisis-economico-investigacion/documentos-ocasionales/el-mercado-del-alquiler-de-vivienda-residencial-en-espana-evolucion-reciente-determinantes-e-indicadores-de-esfuerzo.html",
  supports:
    "Vivienda turística y de no residentes = 3,3% del parque nacional, cerca del 14% en Alicante y Málaga. Recoge el estudio de la Universidad de Málaga: subidas del alquiler del 31% al 33% donde la vivienda turística supera el 10% del parque.",
  checkedAt: CHECKED,
};

const SRC_INE: TalkingSource = {
  id: "ine-viv-turistica",
  org: "Instituto Nacional de Estadística (INE)",
  title:
    "Medición del número de viviendas turísticas en España (estadística experimental)",
  url: "https://www.ine.es/experimental/viv_turistica/experimental_viv_turistica.htm",
  supports:
    "329.764 viviendas turísticas en noviembre de 2025, un 1,24% del parque censado, con una caída interanual del 12,4%.",
  checkedAt: CHECKED,
  needsVerification: true,
};

const SRC_AETIB: TalkingSource = {
  id: "aetib-2024",
  org: "AETIB, Govern de les Illes Balears",
  title:
    "El 69,1% de los residentes baleares coincide con la limitación turística que aprobó el Govern",
  url: "https://www.caib.es/pidip2front/jsp/es/ficha-convocatoria/el-691-de-los-residentes-baleares-coincide-con-la-limitacion-turistica-que-aprobo-el-govern-en-mayo",
  supports:
    "69,1% de 2.008 encuestados está de acuerdo o muy de acuerdo con limitar el número de visitantes. 49,8% cree que el turismo tiene un efecto positivo importante en la generación de riqueza.",
  checkedAt: CHECKED,
};

const SRC_BBK_ZAHLUNG: TalkingSource = {
  id: "bbk-zahlungsverhalten-2023",
  org: "Deutsche Bundesbank",
  title: "Zahlungsverhalten in Deutschland 2023",
  url: "https://www.bundesbank.de/de/presse/pressenotizen/zahlungsverhalten-in-deutschland-2023-934828",
  supports:
    "51 % aller Transaktionen bar (2021: 58 %). Debitkarte 27 % der Bezahlvorgänge (+5 Pp). Nach Umsatz: Debitkarte 32 %, Bargeld 26 %. Mobiles Bezahlen 6 %, seit 2021 verdreifacht. Forsa, rund 5.700 Befragte, Zahlungstagebuch über drei Tage, September bis November 2023.",
  checkedAt: CHECKED,
};

const SRC_BBK_KOSTEN: TalkingSource = {
  id: "bbk-kosten-einzelhandel",
  org: "Deutsche Bundesbank",
  title: "Kosten der Bargeldzahlung im Einzelhandel",
  url: "https://www.bundesbank.de/de/publikationen/berichte/studien/kosten-der-bargeldzahlung-im-einzelhandel-776464",
  supports:
    "Kosten je Transaktion f\u00fcr den H\u00e4ndler: Bargeld rund 24 Cent, girocard 33 Cent, Lastschrift 34 Cent, Kreditkarte mit PIN 97 Cent und mit Unterschrift 1,04 Euro. Dauer an der Kasse: bar gut 22 Sekunden, Karte mit PIN rund 29, mit Unterschrift rund 38.",
  checkedAt: CHECKED,
};

const SRC_BBK_MEINUNG: TalkingSource = {
  id: "bbk-bargeld-meinungsbild",
  org: "Deutsche Bundesbank",
  title: "Bargeld in der deutschen Gesellschaft: ein aktuelles Meinungsbild",
  url: "https://publikationen.bundesbank.de/publikationen-de/berichte-studien/monatsberichte/bargeld-in-der-deutschen-gesellschaft-ein-aktuelles-meinungsbild-954600",
  supports:
    "69 % halten es für wichtig, selbst bar zahlen zu können; 72 % halten Bargeld für die Gesellschaft für wichtig. Wichtigste Argumente: Ausfallsicherheit bei Stromausfall oder Hackerangriff, Kinder lernen den Umgang mit Geld, Datenschutz und Anonymität, Inklusion. Mehr als die Hälfte sieht in Schwarzarbeit, Steuerhinterziehung und Geldwäsche einen Grund, Bargeld einzuschränken.",
  checkedAt: CHECKED,
};

/** Shorthand for a topic whose three pieces are titled but not yet written. */
function piece(
  slug: string,
  title: string,
  hook: string,
  angle: PieceAngle,
): TalkingPiece {
  return { slug, title, hook, angle, body: [], vocab: [], sources: [] };
}

export const TALKING_TOPICS: TalkingTopic[] = [
  {
    slug: "turismo-y-vivienda",
    label: "Tourism & Housing",
    categoryId: "city-housing",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "The fight over who gets to live in the places you visit.",
    pieces: [
      {
        slug: "limitar-turistas",
        title: "¿Debería España limitar el número de turistas?",
        hook: "You are the tourist. Spain is arguing about you.",
        angle: "debate",
        body: [
          "Si alguna vez has alquilado un piso en España, dormiste en un edificio donde había una discusión abierta por tu culpa. No contigo. Entre ellos.",
          "En Baleares el Govern aprobó una limitación de visitantes y después preguntó. Encuestó a dos mil residentes. Siete de cada diez dijeron que sí, que había que poner un tope.",
          "Los que dicen que sí hablan de alquiler. En un barrio donde uno de cada diez pisos es turístico, alquilar cuesta un tercio más. No un poco más. Un tercio. Si pagabas novecientos euros, pagas mil doscientos, y tu sueldo sigue donde estaba. La cifra es de la Universidad de Málaga y la recoge el Banco de España.",
          "Los que dicen que no están dentro de esa misma encuesta. La mitad de esas dos mil personas también dice que el turismo tiene un efecto importante en la riqueza del sitio donde viven. No es una contradicción. Es lo que pasa cuando vives de algo que además te aprieta.",
          "Así que no hay un bando que quiera turistas y otro que no los quiera. Hay dos mil personas que quieren las dos cosas.",
        ],
        vocab: [
          {
            term: "alquilar",
            surface: "alquilado",
            type: "verb",
            en: "To rent; to pay to live in a home you do not own.",
          },
          {
            term: "el piso",
            surface: "piso",
            type: "noun",
            register: "regional",
            en: "A flat; the Spanish word for an apartment, where Latin America says 'departamento'.",
          },
          {
            term: "por tu culpa",
            type: "expression",
            register: "colloquial",
            en: "Because of you; puts the blame on someone directly, and it stings.",
          },
          {
            term: "dormir",
            surface: "dormiste",
            type: "verb",
            en: "To sleep; here, simply to spend the night somewhere.",
          },
          {
            term: "aprobar",
            surface: "aprobó",
            type: "verb",
            en: "To approve; to pass a law or a measure officially.",
          },
          {
            term: "encuestar",
            surface: "Encuestó",
            type: "verb",
            en: "To poll; to ask a sample of people what they think.",
          },
          {
            term: "poner un tope",
            type: "expression",
            en: "To set a cap; to fix a maximum that cannot be crossed.",
          },
          {
            term: "el residente",
            surface: "residentes",
            type: "noun",
            en: "A resident; someone who lives in a place rather than visits it.",
          },
          {
            term: "turístico",
            surface: "turístico",
            type: "adjective",
            en: "Tourist-; describes what exists for visitors rather than for the people who live there.",
          },
          {
            term: "costar",
            surface: "cuesta",
            type: "verb",
            en: "To cost; to carry a given price.",
          },
          {
            term: "el sueldo",
            surface: "sueldo",
            type: "noun",
            en: "A salary; the money your job pays you each month.",
          },
          {
            term: "recoger",
            surface: "recoge",
            type: "verb",
            en: "To pick up; here, what one institution does when it cites another's figure.",
          },
          {
            term: "vivir de",
            surface: "vives de",
            type: "expression",
            en: "To live off; to make your living from something.",
          },
          {
            term: "la riqueza",
            surface: "riqueza",
            type: "noun",
            en: "Wealth; the prosperity a place generates, not one person's money.",
          },
          {
            term: "apretar",
            surface: "aprieta",
            type: "verb",
            register: "colloquial",
            en: "To squeeze; said of something that presses on you, here the cost of the thing you depend on.",
          },
          {
            term: "la encuesta",
            surface: "encuesta",
            type: "noun",
            en: "A survey; the poll itself and the answers it produced.",
          },
          {
            term: "el bando",
            surface: "bando",
            type: "noun",
            en: "A side; one of the two camps people line up in during an argument.",
          },
          {
            term: "las dos cosas",
            type: "expression",
            register: "colloquial",
            en: "Both things; wanting two things that look like they cancel each other out.",
          },
          {
            term: "así que",
            surface: "Así que",
            type: "conjunction",
            en: "So; introduces the conclusion that follows from what was just said.",
          },
        ],
        sources: [SRC_AETIB, SRC_BDE],
        photo: {
          url: "https://upload.wikimedia.org/wikipedia/commons/c/c4/2014-_MV_Arcadia_Cruise_Ship%2C_Port_of_Barcelona%2C_Spain_%28_Ank_Kumar_%29_01.jpg",
          filePage:
            "https://commons.wikimedia.org/wiki/File:2014-_MV_Arcadia_Cruise_Ship,_Port_of_Barcelona,_Spain_(_Ank_Kumar_)_01.jpg",
          author: "Ank Kumar",
          licence: "CC BY-SA 4.0",
          alt: "Un crucero atracado en el puerto de Barcelona, visto desde el muelle.",
          width: 4369,
          height: 2913,
        },
      },
      {
        slug: "por-que-no-baja-el-alquiler",
        title: "Bajan los pisos turísticos y el alquiler no baja",
        hook: "The obvious fix isn't working. Here's why.",
        angle: "explainer",
        body: [
          "Este año hay menos pisos turísticos en España que el año pasado. De cada cien que había, han desaparecido doce. Es la mayor caída desde que se cuentan.",
          "Si la explicación fuera la que repite todo el mundo, el alquiler tendría que haber bajado con ellos. No bajó.",
          "El INE los cuenta dos veces al año rastreando las plataformas. En noviembre quedaban unos trescientos treinta mil. Suena a muchísimo. Sobre el total de viviendas del país es el uno por ciento largo.",
          "Y ahí está la trampa de las medias. El Banco de España suma la vivienda turística y la que compran extranjeros que no viven aquí: el tres por ciento de España. En Alicante y en Málaga, el catorce. Uno de cada siete pisos.",
          "Por eso el mismo dato sirve para decir cosas contrarias. En Málaga el turismo mueve el precio de barrios enteros. En casi todo el resto del país no se nota. Y el precio del país no lo decide quién duerme en un piso, lo decide cuántos pisos hay.",
        ],
        vocab: [
          {
            term: "desaparecer",
            surface: "desaparecido",
            type: "verb",
            en: "To disappear; to stop existing, here to drop off the register altogether.",
          },
          {
            term: "la caída",
            surface: "caída",
            type: "noun",
            en: "A fall; a drop in a figure from one measurement to the next.",
          },
          {
            term: "de cada cien",
            surface: "De cada cien",
            type: "expression",
            en: "Out of every hundred; the everyday way to say a percentage out loud.",
          },
          {
            term: "la explicación",
            surface: "explicación",
            type: "noun",
            en: "The explanation; the reason people give for why something happens.",
          },
          {
            term: "repetir",
            surface: "repite",
            type: "verb",
            en: "To repeat; here, to keep saying the same thing until it sounds true.",
          },
          {
            term: "todo el mundo",
            type: "expression",
            register: "colloquial",
            en: "Everybody; literally 'the whole world', and far more common than 'todos'.",
          },
          {
            term: "rastrear",
            surface: "rastreando",
            type: "verb",
            en: "To trawl; to comb through a source systematically looking for data.",
          },
          {
            term: "quedar",
            surface: "quedaban",
            type: "verb",
            en: "To be left; what remains after some of the total has gone.",
          },
          {
            term: "la vivienda",
            surface: "viviendas",
            type: "noun",
            en: "Housing; the formal word used in statistics and policy, not for your own home.",
          },
          {
            term: "largo",
            type: "adjective",
            register: "colloquial",
            en: "And a bit; placed after a number, it means slightly more than that ('el uno por ciento largo').",
          },
          {
            term: "la trampa",
            surface: "trampa",
            type: "noun",
            register: "colloquial",
            en: "The catch; the hidden trick that makes a true figure mislead you.",
          },
          {
            term: "la media",
            surface: "medias",
            type: "noun",
            en: "The average; the single number that hides how uneven the parts are.",
          },
          {
            term: "sumar",
            surface: "suma",
            type: "verb",
            en: "To add together; to put two figures into one total.",
          },
          {
            term: "el extranjero",
            surface: "extranjeros",
            type: "noun",
            en: "A foreigner; here, a buyer who owns a home in a country they do not live in.",
          },
          {
            term: "servir para",
            surface: "sirve para",
            type: "expression",
            en: "To be good for; what a thing can be used to do.",
          },
          {
            term: "mover",
            surface: "mueve",
            type: "verb",
            en: "To move; here, what pushes a price up or down.",
          },
          {
            term: "notarse",
            surface: "nota",
            type: "verb",
            register: "colloquial",
            en: "To be noticeable; to show enough that people feel it.",
          },
        ],
        sources: [SRC_INE, SRC_BDE],
        photo: {
          url: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Madrid_-_Demonstration_-_Housing_Is_costing_us_our_lives_-_260524_121127.jpg",
          filePage:
            "https://commons.wikimedia.org/wiki/File:Madrid_-_Demonstration_-_Housing_Is_costing_us_our_lives_-_260524_121127.jpg",
          author: "Barcex",
          licence: "CC BY-SA 4.0",
          alt: "Manifestación por la vivienda en Madrid, con gente y pancartas llenando la calle.",
          width: 4582,
          height: 3055,
        },
      },
      {
        slug: "el-barrio-sin-vecinos",
        title: "El barrio donde ya no vive nadie",
        hook: "Key boxes on every door, suitcases at six in the morning.",
        angle: "portrait",
        body: [
          "Primero aparece una caja de llaves en el portal. Negra, pequeña, con teclas. Después hay cuatro. Después está toda la fachada llena.",
          "El ruido cambia antes que el precio. En julio se oyen ruedas de maleta a las seis de la mañana. En enero no se oye nada, porque en enero no hay nadie.",
          "Los comercios caen por orden. El panadero cierra el primero, porque el pan se compra a diario y en invierno no hay quien lo compre. La farmacia aguanta. El bar aguanta más, porque el bar vive del verano.",
          "El Banco de España tiene un número para todo esto. Pasado cierto punto, el alquiler del barrio se dispara. Los vecinos lo sabían un año antes, mirando los portales.",
          "Lo último que se va es la asociación de vecinos. Convoca una reunión, pone la fecha en el tablón del portal, y no baja nadie.",
        ],
        vocab: [
          {
            term: "aparecer",
            surface: "aparece",
            type: "verb",
            en: "To appear; to show up somewhere it was not before.",
          },
          {
            term: "el portal",
            surface: "portal",
            type: "noun",
            register: "regional",
            en: "The entrance hall of a block of flats in Spain; the shared space between the street door and the stairs.",
          },
          {
            term: "la fachada",
            surface: "fachada",
            type: "noun",
            en: "The facade; the front wall of a building, the face it shows the street.",
          },
          {
            term: "el ruido",
            surface: "ruido",
            type: "noun",
            en: "Noise; unwanted sound, here the sound of a neighbourhood changing hands.",
          },
          {
            term: "cambiar",
            surface: "cambia",
            type: "verb",
            en: "To change; to become something different.",
          },
          {
            term: "oírse",
            surface: "se oyen",
            type: "verb",
            en: "To be heard; used when nobody in particular is doing the hearing.",
          },
          {
            term: "el comercio",
            surface: "comercios",
            type: "noun",
            en: "A shop; the small local business, seen as part of the street's life.",
          },
          {
            term: "a diario",
            type: "expression",
            en: "Daily; every single day, said of a habit rather than a schedule.",
          },
          {
            term: "aguantar",
            surface: "aguanta",
            type: "verb",
            register: "colloquial",
            en: "To hold out; to survive pressure a while longer without giving in.",
          },
          {
            term: "dispararse",
            surface: "dispara",
            type: "verb",
            register: "colloquial",
            en: "To shoot up; said of a price that rises suddenly and steeply.",
          },
          {
            term: "el vecino",
            surface: "vecinos",
            type: "noun",
            en: "A neighbour; here, the people who actually live in the building all year.",
          },
          {
            term: "pasado cierto punto",
            surface: "Pasado cierto punto",
            type: "expression",
            en: "Past a certain point; beyond a threshold where behaviour changes.",
          },
          {
            term: "convocar",
            surface: "Convoca",
            type: "verb",
            en: "To call; to summon people to a meeting on a set date.",
          },
          {
            term: "el tablón",
            surface: "tablón",
            type: "noun",
            register: "regional",
            en: "The noticeboard in the entrance of a Spanish block of flats, where neighbours pin announcements.",
          },
          {
            term: "lo último",
            surface: "Lo último",
            type: "expression",
            en: "The last thing; what survives after everything else has gone.",
          },
        ],
        sources: [SRC_BDE],
        photo: {
          url: "https://upload.wikimedia.org/wikipedia/commons/d/d0/C%C3%A1diz_%287077356971%29.jpg",
          filePage:
            "https://commons.wikimedia.org/wiki/File:C%C3%A1diz_(7077356971).jpg",
          author: "Michal Osmenda",
          licence: "CC BY 2.0",
          alt: "Calle estrecha del casco antiguo de Cádiz, con balcones a ambos lados y casi nadie a la vista.",
          width: 3623,
          height: 2406,
        },
      },
    ],
  },
  {
    slug: "alquilar-de-joven",
    label: "Renting Young",
    categoryId: "city-housing",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Leaving home later than any generation before.",
    pieces: [
      piece(
        "compartir-piso-a-los-35",
        "Compartir piso a los treinta y cinco",
        "Flatmates are no longer a student thing.",
        "portrait",
      ),
      piece(
        "irse-de-casa",
        "¿Por qué cuesta tanto irse de casa?",
        "The age of leaving home keeps climbing.",
        "explainer",
      ),
      piece(
        "limitar-precios",
        "¿Funciona limitar el precio del alquiler?",
        "Every country tries it. Nobody agrees on the result.",
        "debate",
      ),
    ],
  },
  {
    slug: "sueldos-y-llegar-a-fin-de-mes",
    label: "Salaries & Getting By",
    categoryId: "money-work",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "What people earn, and what that actually buys.",
    pieces: [
      piece(
        "el-sueldo-que-no-se-dice",
        "El sueldo del que nadie habla",
        "Talking money is still taboo. That's changing.",
        "portrait",
      ),
      piece(
        "salario-minimo",
        "¿Sube el paro cuando sube el salario mínimo?",
        "The oldest argument in economics, live.",
        "debate",
      ),
      piece(
        "por-que-no-cunde",
        "Por qué el sueldo ya no cunde igual",
        "Same salary, smaller life.",
        "explainer",
      ),
    ],
  },
  {
    slug: "la-jornada-laboral",
    label: "The Working Day",
    categoryId: "money-work",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Spain works odd hours and is arguing about it.",
    pieces: [
      piece(
        "semana-de-cuatro-dias",
        "¿Cuatro días de trabajo son suficientes?",
        "The four-day week left the pilot stage.",
        "debate",
      ),
      piece(
        "de-donde-viene-el-horario",
        "De dónde salió el horario español",
        "Blame a decision made in 1940.",
        "explainer",
      ),
      piece(
        "comer-a-las-tres",
        "Comer a las tres y cenar a las diez",
        "A whole country running on a different clock.",
        "portrait",
      ),
    ],
  },
  {
    slug: "la-sobremesa",
    label: "Eating Together",
    categoryId: "food-table",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "The meal ends. Nobody gets up.",
    pieces: [
      piece(
        "que-es-la-sobremesa",
        "La hora que no aparece en la agenda",
        "There is no English word for it. That matters.",
        "portrait",
      ),
      piece(
        "se-pierde-la-sobremesa",
        "¿Se está perdiendo la sobremesa?",
        "Lunch breaks are shrinking everywhere.",
        "debate",
      ),
      piece(
        "comer-en-el-trabajo",
        "Qué se come de verdad en la oficina",
        "The tupper generation.",
        "explainer",
      ),
    ],
  },
  {
    slug: "como-se-come-ahora",
    label: "How Spain Eats Now",
    categoryId: "food-table",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "The Mediterranean diet, and the gap with the fridge.",
    pieces: [
      piece(
        "dieta-mediterranea",
        "La dieta mediterránea, según los datos",
        "The famous diet, minus the marketing.",
        "explainer",
      ),
      piece(
        "carne-o-no",
        "¿Comemos demasiada carne?",
        "A fight about health, money and identity.",
        "debate",
      ),
      piece(
        "el-menu-del-dia",
        "El menú del día es una institución",
        "Three courses, bread, wine, one price.",
        "portrait",
      ),
    ],
  },
  {
    slug: "acentos-y-prejuicios",
    label: "Accents & Prejudice",
    categoryId: "language-speech",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Which Spanish sounds 'correct', and who decided.",
    pieces: [
      piece(
        "el-espanol-correcto",
        "¿Existe un español correcto?",
        "Ask two Spanish speakers, start a war.",
        "debate",
      ),
      piece(
        "acento-y-trabajo",
        "El acento en una entrevista de trabajo",
        "People soften their vowels to get hired.",
        "portrait",
      ),
      piece(
        "por-que-suena-distinto",
        "Por qué el sur suena distinto",
        "One consonant explains half of it.",
        "explainer",
      ),
    ],
  },
  {
    slug: "lenguaje-inclusivo",
    label: "Inclusive Language",
    categoryId: "language-speech",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "The argument your textbook will never mention.",
    pieces: [
      piece(
        "todes",
        "¿El lenguaje inclusivo mejora el idioma o lo rompe?",
        "Both sides think the other is breaking Spanish.",
        "debate",
      ),
      piece(
        "que-dice-la-rae",
        "Qué dice exactamente la RAE",
        "Less than either side claims.",
        "explainer",
      ),
      piece(
        "como-se-habla-de-verdad",
        "Cómo se habla de verdad en clase",
        "Teachers had to decide before anyone agreed.",
        "portrait",
      ),
    ],
  },
  {
    slug: "el-movil-y-la-atencion",
    label: "Phones & Attention",
    categoryId: "tech-internet",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Screens, sleep, and what schools decided to do.",
    pieces: [
      piece(
        "movil-en-clase",
        "¿Fuera el móvil de las aulas?",
        "Several regions already banned it.",
        "debate",
      ),
      piece(
        "dormir-con-el-movil",
        "Dormir con el móvil en la mesilla",
        "The last thing you see, the first thing you touch.",
        "portrait",
      ),
      piece(
        "por-que-enganchan",
        "Por qué enganchan tanto",
        "Designed to be hard to put down.",
        "explainer",
      ),
    ],
  },
  {
    slug: "ia-y-empleo",
    label: "AI & Jobs",
    categoryId: "tech-internet",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Which jobs change, which disappear, which nobody knows.",
    pieces: [
      piece(
        "que-trabajos-cambian",
        "Qué trabajos están cambiando ya",
        "Not the ones anyone predicted.",
        "explainer",
      ),
      piece(
        "hay-que-regularla",
        "¿Hay que frenar la inteligencia artificial?",
        "Slow it down, or fall behind. Pick one.",
        "debate",
      ),
      piece(
        "el-traductor",
        "Un traductor cuenta cómo cambió su trabajo",
        "First it helped. Then it competed.",
        "portrait",
      ),
    ],
  },
  {
    slug: "la-soledad",
    label: "Loneliness",
    categoryId: "body-health",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "A country famous for company, talking about being alone.",
    pieces: [
      piece(
        "vivir-solo",
        "Cada vez más gente vive sola",
        "Household size keeps shrinking.",
        "explainer",
      ),
      piece(
        "soledad-no-deseada",
        "La soledad no deseada tiene nombre propio",
        "It got a name, and then a policy.",
        "portrait",
      ),
      piece(
        "es-problema-publico",
        "¿Es la soledad un problema de salud pública?",
        "Some governments say yes. Others resist.",
        "debate",
      ),
    ],
  },
  {
    slug: "agua-y-sequia",
    label: "Water & Drought",
    categoryId: "nature-climate",
    country: "ES",
    language: "Spanish",
    level: "b2",
    blurb: "Who gets the water when there isn't enough.",
    pieces: [
      piece(
        "de-donde-sale-el-agua",
        "De dónde sale el agua que bebes",
        "Reservoirs, rivers and a lot of pipes.",
        "explainer",
      ),
      piece(
        "campos-de-golf",
        "¿Golf y piscinas en zona de sequía?",
        "Tourism, farming and taps, same reservoir.",
        "debate",
      ),
      piece(
        "un-pueblo-sin-agua",
        "El pueblo que se quedó sin grifo",
        "Water arrived by truck for months.",
        "portrait",
      ),
    ],
  },
  {
    slug: "bargeld-und-karte",
    label: "Cash & Cards",
    categoryId: "money-work",
    country: "DE",
    language: "German",
    level: "c1",
    blurb:
      "Half the country still pays in coins. Half of them think that is a problem.",
    pieces: [
      {
        slug: "warum-keine-karte",
        title: "Warum nimmt dieses Café keine Karte?",
        hook: "Your card is fine. The café just doesn’t want it.",
        angle: "debate",
        body: [
          "Du stehst an der Kasse, hältst die Karte hin, und der Mann hinter dem Tresen zeigt auf ein kleines Schild: nur Bargeld. Kein Automat in der Nähe. Draußen regnet es.",
          "Er ist weder altmodisch noch stur. Für ihn ist dein Schein schlicht billiger. Die Bundesbank hat nachgerechnet, was den Handel jede Zahlung kostet: bar rund vierundzwanzig Cent, mit Kreditkarte fast einen Euro. Bei einem Kaffee für drei Euro ist das kein Rundungsfehler.",
          "Es geht auch schneller. Eine Barzahlung dauert an der Kasse gut zwanzig Sekunden, eine Kartenzahlung mit Unterschrift fast vierzig. Und er ist damit nicht allein: In Deutschland wird immer noch jede zweite Zahlung bar gemacht.",
          "Bei den Kunden steht ganz oben nicht die Nostalgie, sondern der Stromausfall. Bargeld funktioniert, wenn die Technik nicht funktioniert. Danach kommt, dass Kinder mit Münzen lernen, was Geld überhaupt ist. Und der Datenschutz: Ein Schein verrät niemandem, wo du am Dienstagabend warst.",
          "Und dann kommt der Widerspruch. Mehr als die Hälfte derselben Befragten sagt, Bargeld erleichtere Schwarzarbeit und Steuerhinterziehung, und genau deshalb solle man es einschränken. Neunundsechzig Prozent wollen bar zahlen können. Über die Hälfte findet, dass genau das ein Problem ist. Der Mann hinter dem Tresen wartet immer noch. Draußen regnet es weiter.",
        ],
        vocab: [
          {
            term: "die Kasse",
            surface: "Kasse",
            type: "noun",
            en: "The till; the counter in a shop where you pay.",
          },
          {
            term: "hinhalten",
            surface: "hältst",
            type: "verb",
            en: "To hold out; to extend something towards someone, here your card.",
          },
          {
            term: "der Tresen",
            surface: "Tresen",
            type: "noun",
            register: "colloquial",
            en: "The counter of a bar or café, the flat surface you stand at to order.",
          },
          {
            term: "in der Nähe",
            type: "expression",
            en: "Nearby; within easy walking distance.",
          },
          {
            term: "stur",
            type: "adjective",
            register: "colloquial",
            en: "Stubborn; refusing to budge, said with mild irritation.",
          },
          {
            term: "der Schein",
            surface: "Schein",
            type: "noun",
            en: "A banknote; the paper money, as opposed to coins.",
          },
          {
            term: "nachrechnen",
            surface: "nachgerechnet",
            type: "verb",
            en: "To work out; to redo the arithmetic to check what something really costs.",
          },
          {
            term: "kosten",
            surface: "kostet",
            type: "verb",
            en: "To cost; to carry a given price.",
          },
          {
            term: "die Barzahlung",
            surface: "Barzahlung",
            type: "noun",
            en: "Payment in cash; the formal term used in banking reports.",
          },
          {
            term: "dauern",
            surface: "dauert",
            type: "verb",
            en: "To take; to last a given amount of time.",
          },
          {
            term: "die Unterschrift",
            surface: "Unterschrift",
            type: "noun",
            en: "A signature; the name you sign, here on a card receipt.",
          },
          {
            term: "immer noch",
            type: "expression",
            en: "Still; emphasises that something has not stopped yet.",
          },
          {
            term: "der Stromausfall",
            surface: "Stromausfall",
            type: "noun",
            en: "A power cut; when the electricity fails and card terminals die with it.",
          },
          {
            term: "die Münze",
            surface: "Münzen",
            type: "noun",
            en: "A coin; the metal money children learn to count with.",
          },
          {
            term: "verraten",
            surface: "verrät",
            type: "verb",
            en: "To give away; to reveal something that was meant to stay private.",
          },
          {
            term: "überhaupt",
            type: "adverb",
            register: "colloquial",
            en: "At all; a small word that widens a question to what something even is.",
          },
          {
            term: "der Widerspruch",
            surface: "Widerspruch",
            type: "noun",
            en: "A contradiction; holding two positions that cannot both hold.",
          },
          {
            term: "erleichtern",
            surface: "erleichtere",
            type: "verb",
            en: "To make easier; here, to remove the friction from something you would rather stop.",
          },
          {
            term: "einschränken",
            type: "verb",
            en: "To restrict; to allow something only within limits.",
          },
          {
            term: "die Schwarzarbeit",
            surface: "Schwarzarbeit",
            type: "noun",
            en: "Undeclared work; work paid in cash and hidden from the tax office.",
          },
        ],
        sources: [SRC_BBK_KOSTEN, SRC_BBK_ZAHLUNG, SRC_BBK_MEINUNG],
        audioUrl:
          "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/Warum_nimmt_dieses_Caf_keine_Karte_1786020915847.mp3",
        audioWordTimings: warumKeineKarteTimings.payload,
        photo: {
          url: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Baristas_serve_espresso_and_cappuccino_at_a_busy_cafe.jpg",
          filePage:
            "https://commons.wikimedia.org/wiki/File:Baristas_serve_espresso_and_cappuccino_at_a_busy_cafe.jpg",
          author: "Shixart1985",
          licence: "CC BY 2.0",
          alt: "Dos baristas sirviendo cafes detras del mostrador de una cafeteria llena.",
          width: 5063,
          height: 3369,
        },
      },
      piece(
        "letzter-geldautomat",
        "Der letzte Geldautomat im Dorf",
        "The cash machine left before the bank did.",
        "portrait",
      ),
      piece(
        "digitaler-euro",
        "Was der digitale Euro wäre und was nicht",
        "Not crypto, not your banking app. Something else.",
        "explainer",
      ),
    ],
  },
];

/**
 * Vocabulary density, in entries per 100 words of body.
 *
 * Ten is the journey figure, and it is not a preference: it is what
 * `StoryContent` documents as the target the whole catalogue aims at
 * (~10 highlighted words per 100 read; a journey story lands around 22
 * entries). A non-fiction piece that carries four entries in two hundred
 * words is an article with some words coloured in, not a language lesson.
 *
 * The band is deliberately narrow. Under it the piece stops teaching; over it
 * the prose disappears under highlights and the reader stops reading.
 */
export const VOCAB_PER_100_WORDS = 10;
export const VOCAB_DENSITY_MIN = 8;
export const VOCAB_DENSITY_MAX = 12;

export function pieceWordCount(piece: TalkingPiece): number {
  return piece.body.join(" ").split(/\s+/).filter(Boolean).length;
}

/** Entries per 100 words. 0 for an unwritten piece. */
export function vocabDensity(piece: TalkingPiece): number {
  const words = pieceWordCount(piece);
  if (words === 0) return 0;
  return (piece.vocab.length / words) * 100;
}

/**
 * Every vocab entry must actually appear in the body, in the exact form the
 * highlighter will look for. `StoryContent` matches on the surface string, so
 * an entry whose form never occurs is invisible: it teaches nothing and nobody
 * finds out. Returns the offending terms.
 */
export function missingVocabSurfaces(piece: TalkingPiece): string[] {
  const body = piece.body.join(" ");
  return piece.vocab
    .filter((v) => !body.includes(v.surface ?? v.term))
    .map((v) => v.term);
}

/**
 * Type balance. A list that is two thirds nouns teaches labels, not language:
 * the learner can already point at a counter, what they cannot do is say what
 * happens at it. Verbs and fixed expressions are what transfer.
 *
 * Nouns are capped rather than banned because non-fiction genuinely brings
 * them: institutions, instruments, quantities.
 */
export const VOCAB_MAX_NOUN_SHARE = 50;
export const VOCAB_MIN_VERB_SHARE = 25;
/** Adjectives, adverbs and set phrases. At least this many per piece. */
export const VOCAB_MIN_OTHER = 2;

/**
 * Country name for the ISO code in `country`.
 *
 * The reader's region badge expects a NAME, the way journey stories store it
 * ("Germany", "Spain"), not a code: it runs the value through `formatRegion`,
 * which title-cases whatever it gets, so a raw "DE" reaches the screen as
 * "De"; sitting right next to the language badge that already says "DE".
 *
 * Returns null for a code that is not on the list, and the caller then draws
 * no region badge at all. A missing name is better than a mangled one, and
 * this map is one line per country as the catalogue grows.
 */
export function countryLabel(code: string): string | null {
  const NAMES: Record<string, string> = {
    ES: "Spain",
    DE: "Germany",
    AT: "Austria",
    MX: "Mexico",
    CO: "Colombia",
    AR: "Argentina",
    PE: "Peru",
    CL: "Chile",
    FR: "France",
    IT: "Italy",
    PT: "Portugal",
    BR: "Brazil",
  };
  return NAMES[code.trim().toUpperCase()] ?? null;
}

function isNoun(t: string) {
  return t.includes("noun");
}
function isVerb(t: string) {
  return t.startsWith("verb");
}

export function vocabTypeMix(piece: TalkingPiece): {
  nounShare: number;
  verbShare: number;
  other: number;
} {
  const n = piece.vocab.length;
  if (n === 0) return { nounShare: 0, verbShare: 0, other: 0 };
  const nouns = piece.vocab.filter((v) => isNoun(v.type)).length;
  const verbs = piece.vocab.filter((v) => isVerb(v.type)).length;
  return {
    nounShare: (nouns / n) * 100,
    verbShare: (verbs / n) * 100,
    other: n - nouns - verbs,
  };
}

/**
 * Vocab entries per paragraph. The rule the journey stories already follow:
 * three to five per paragraph, and no single paragraph holding more than about
 * a third of the list. Otherwise every highlight lands in the first thirty
 * seconds and the rest of the audio teaches nothing.
 */
export function vocabPerParagraph(piece: TalkingPiece): number[] {
  // Each entry counts ONCE, in the first paragraph where it appears. Counting
  // it in every paragraph inflated the totals past the list length and made a
  // front-loaded piece look evenly spread.
  const counts = piece.body.map(() => 0);
  for (const v of piece.vocab) {
    const needle = v.surface ?? v.term;
    const i = piece.body.findIndex((para) => para.includes(needle));
    if (i >= 0) counts[i] += 1;
  }
  return counts;
}
export const VOCAB_MAX_PARAGRAPH_SHARE = 33;

/**
 * A piece with its topic attached. The browse UI always needs both: the
 * question carries the card, the topic labels it.
 */
export type TalkingEntry = { topic: TalkingTopic; piece: TalkingPiece };

export function getTopics(): TalkingTopic[] {
  return TALKING_TOPICS;
}

/** Every piece in the catalogue, flattened. There is no order to preserve. */
export function getEntries(): TalkingEntry[] {
  return TALKING_TOPICS.flatMap((topic) =>
    topic.pieces.map((piece) => ({ topic, piece })),
  );
}

/**
 * Entries grouped into the browse rows, written ones first inside each row.
 * Categories with nothing in them are dropped rather than rendered empty.
 */
export function getEntriesByCategory(): Array<{
  category: TalkingCategory;
  entries: TalkingEntry[];
}> {
  return TALKING_CATEGORIES.map((category) => ({
    category,
    entries: getEntries()
      .filter((e) => e.topic.categoryId === category.id)
      .sort(
        (a, b) =>
          Number(b.piece.body.length > 0) - Number(a.piece.body.length > 0),
      ),
  })).filter((row) => row.entries.length > 0);
}

/** Pieces that are actually readable right now. Drives the top row. */
export function getReadableEntries(): TalkingEntry[] {
  return getEntries().filter((e) => e.piece.body.length > 0);
}

/** Other pieces under the same topic, for the strip at the end of a piece. */
export function getSiblings(pieceSlug: string): TalkingEntry[] {
  const found = getPiece(pieceSlug);
  if (!found) return [];
  return found.topic.pieces
    .filter((p) => p.slug !== pieceSlug)
    .map((piece) => ({ topic: found.topic, piece }));
}

export function getTopic(slug: string): TalkingTopic | undefined {
  return TALKING_TOPICS.find((t) => t.slug === slug);
}

export function getPiece(
  slug: string,
): { topic: TalkingTopic; piece: TalkingPiece } | undefined {
  for (const topic of TALKING_TOPICS) {
    const found = topic.pieces.find((p) => p.slug === slug);
    if (found) return { topic, piece: found };
  }
  return undefined;
}

/** How many of a topic's pieces actually have a body written. */
export function writtenCount(topic: TalkingTopic): number {
  return topic.pieces.filter((p) => p.body.length > 0).length;
}
