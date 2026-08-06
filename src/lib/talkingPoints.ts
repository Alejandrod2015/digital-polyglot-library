// /src/lib/talkingPoints.ts
//
// PROTOTYPE (worktree `talking-points`, not production).
//
// TALKING POINTS is not a new section. It is a new `journeyType`: same level,
// same 7 topics, same 3 stories per topic, same banner / story cards / reader.
// Two things differ from Friends, Traveler and Expat:
//
//   1. The 7 topics are NOT fixed in `JOURNEY_CURRICULUM`. The user picks them.
//   2. The stories are non-fiction, so every factual claim carries a source.
//
// WHY the user picks: a journey works because it is CLOSED (21 and you're
// done) — that closure is the whole engine behind progress, "next" and
// completion. Non-fiction is an open, growing catalogue. Dropping an infinite
// feed into a finite-path UI kills the engine. Letting the user choose 7 is
// what closes the set: infinite catalogue, finite runs.
//
// Content lives here as a typed literal so the prototype runs with no database
// and no secrets.

import type { Plan } from "@domain/access";

/**
 * Who can open Talking Points.
 *
 * Polyglot (and owner) only, like `/create`. The nav entry is hidden for
 * everyone else, but hiding a link is not a gate — every route calls this too.
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
  /** Definition in English: the audience is anglophone. */
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
};

export type TalkingTopic = {
  slug: string;
  /** Topic banner title. English, like every journey topic label. */
  label: string;
  categoryId: CategoryId;
  /** ISO 3166-1 alpha-2, drives the flag and the voice country. */
  country: string;
  language: string;
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
  title: "Medición del número de viviendas turísticas en España (estadística experimental)",
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

/** Shorthand for a topic whose three pieces are titled but not yet written. */
function piece(
  slug: string,
  title: string,
  hook: string,
  angle: PieceAngle
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
          { term: "poner un tope", type: "verb phrase", en: "to set a cap" },
          { term: "el alquiler", surface: "alquiler", type: "noun", en: "rent" },
          { term: "apretar", surface: "aprieta", type: "verb", en: "to squeeze, to be tight on someone" },
          { term: "el bando", surface: "bando", type: "noun", en: "side, camp (in a dispute)" },
        ],
        sources: [SRC_AETIB, SRC_BDE],
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
          { term: "la media", surface: "medias", type: "noun", en: "the average" },
          { term: "largo", type: "adjective", en: "a bit over (after a number)" },
          { term: "rastrear", surface: "rastreando", type: "verb", en: "to track, to trawl" },
          { term: "la trampa", surface: "trampa", type: "noun", en: "the catch, the trick" },
        ],
        sources: [SRC_INE, SRC_BDE],
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
          { term: "el portal", surface: "portal", type: "noun", en: "building entrance, lobby" },
          { term: "la fachada", surface: "fachada", type: "noun", en: "facade, front of a building" },
          { term: "aguantar", surface: "aguanta", type: "verb", en: "to hold out, to endure" },
          { term: "el tablón", surface: "tablón", type: "noun", en: "noticeboard" },
        ],
        sources: [SRC_BDE],
      },
    ],
  },
  {
    slug: "alquilar-de-joven",
    label: "Renting Young",
    categoryId: "city-housing",
    country: "ES",
    language: "Spanish",
    blurb: "Leaving home later than any generation before.",
    pieces: [
      piece("compartir-piso-a-los-35", "Compartir piso a los treinta y cinco", "Flatmates are no longer a student thing.", "portrait"),
      piece("irse-de-casa", "¿Por qué cuesta tanto irse de casa?", "The age of leaving home keeps climbing.", "explainer"),
      piece("limitar-precios", "¿Funciona limitar el precio del alquiler?", "Every country tries it. Nobody agrees on the result.", "debate"),
    ],
  },
  {
    slug: "sueldos-y-llegar-a-fin-de-mes",
    label: "Salaries & Getting By",
    categoryId: "money-work",
    country: "ES",
    language: "Spanish",
    blurb: "What people earn, and what that actually buys.",
    pieces: [
      piece("el-sueldo-que-no-se-dice", "El sueldo del que nadie habla", "Talking money is still taboo. That's changing.", "portrait"),
      piece("salario-minimo", "¿Sube el paro cuando sube el salario mínimo?", "The oldest argument in economics, live.", "debate"),
      piece("por-que-no-cunde", "Por qué el sueldo ya no cunde igual", "Same salary, smaller life.", "explainer"),
    ],
  },
  {
    slug: "la-jornada-laboral",
    label: "The Working Day",
    categoryId: "money-work",
    country: "ES",
    language: "Spanish",
    blurb: "Spain works odd hours and is arguing about it.",
    pieces: [
      piece("semana-de-cuatro-dias", "¿Cuatro días de trabajo son suficientes?", "The four-day week left the pilot stage.", "debate"),
      piece("de-donde-viene-el-horario", "De dónde salió el horario español", "Blame a decision made in 1940.", "explainer"),
      piece("comer-a-las-tres", "Comer a las tres y cenar a las diez", "A whole country running on a different clock.", "portrait"),
    ],
  },
  {
    slug: "la-sobremesa",
    label: "Eating Together",
    categoryId: "food-table",
    country: "ES",
    language: "Spanish",
    blurb: "The meal ends. Nobody gets up.",
    pieces: [
      piece("que-es-la-sobremesa", "La hora que no aparece en la agenda", "There is no English word for it. That matters.", "portrait"),
      piece("se-pierde-la-sobremesa", "¿Se está perdiendo la sobremesa?", "Lunch breaks are shrinking everywhere.", "debate"),
      piece("comer-en-el-trabajo", "Qué se come de verdad en la oficina", "The tupper generation.", "explainer"),
    ],
  },
  {
    slug: "como-se-come-ahora",
    label: "How Spain Eats Now",
    categoryId: "food-table",
    country: "ES",
    language: "Spanish",
    blurb: "The Mediterranean diet, and the gap with the fridge.",
    pieces: [
      piece("dieta-mediterranea", "La dieta mediterránea, según los datos", "The famous diet, minus the marketing.", "explainer"),
      piece("carne-o-no", "¿Comemos demasiada carne?", "A fight about health, money and identity.", "debate"),
      piece("el-menu-del-dia", "El menú del día es una institución", "Three courses, bread, wine, one price.", "portrait"),
    ],
  },
  {
    slug: "acentos-y-prejuicios",
    label: "Accents & Prejudice",
    categoryId: "language-speech",
    country: "ES",
    language: "Spanish",
    blurb: "Which Spanish sounds 'correct', and who decided.",
    pieces: [
      piece("el-espanol-correcto", "¿Existe un español correcto?", "Ask two Spanish speakers, start a war.", "debate"),
      piece("acento-y-trabajo", "El acento en una entrevista de trabajo", "People soften their vowels to get hired.", "portrait"),
      piece("por-que-suena-distinto", "Por qué el sur suena distinto", "One consonant explains half of it.", "explainer"),
    ],
  },
  {
    slug: "lenguaje-inclusivo",
    label: "Inclusive Language",
    categoryId: "language-speech",
    country: "ES",
    language: "Spanish",
    blurb: "The argument your textbook will never mention.",
    pieces: [
      piece("todes", "¿El lenguaje inclusivo mejora el idioma o lo rompe?", "Both sides think the other is breaking Spanish.", "debate"),
      piece("que-dice-la-rae", "Qué dice exactamente la RAE", "Less than either side claims.", "explainer"),
      piece("como-se-habla-de-verdad", "Cómo se habla de verdad en clase", "Teachers had to decide before anyone agreed.", "portrait"),
    ],
  },
  {
    slug: "el-movil-y-la-atencion",
    label: "Phones & Attention",
    categoryId: "tech-internet",
    country: "ES",
    language: "Spanish",
    blurb: "Screens, sleep, and what schools decided to do.",
    pieces: [
      piece("movil-en-clase", "¿Fuera el móvil de las aulas?", "Several regions already banned it.", "debate"),
      piece("dormir-con-el-movil", "Dormir con el móvil en la mesilla", "The last thing you see, the first thing you touch.", "portrait"),
      piece("por-que-enganchan", "Por qué enganchan tanto", "Designed to be hard to put down.", "explainer"),
    ],
  },
  {
    slug: "ia-y-empleo",
    label: "AI & Jobs",
    categoryId: "tech-internet",
    country: "ES",
    language: "Spanish",
    blurb: "Which jobs change, which disappear, which nobody knows.",
    pieces: [
      piece("que-trabajos-cambian", "Qué trabajos están cambiando ya", "Not the ones anyone predicted.", "explainer"),
      piece("hay-que-regularla", "¿Hay que frenar la inteligencia artificial?", "Slow it down, or fall behind. Pick one.", "debate"),
      piece("el-traductor", "Un traductor cuenta cómo cambió su trabajo", "First it helped. Then it competed.", "portrait"),
    ],
  },
  {
    slug: "la-soledad",
    label: "Loneliness",
    categoryId: "body-health",
    country: "ES",
    language: "Spanish",
    blurb: "A country famous for company, talking about being alone.",
    pieces: [
      piece("vivir-solo", "Cada vez más gente vive sola", "Household size keeps shrinking.", "explainer"),
      piece("soledad-no-deseada", "La soledad no deseada tiene nombre propio", "It got a name, and then a policy.", "portrait"),
      piece("es-problema-publico", "¿Es la soledad un problema de salud pública?", "Some governments say yes. Others resist.", "debate"),
    ],
  },
  {
    slug: "agua-y-sequia",
    label: "Water & Drought",
    categoryId: "nature-climate",
    country: "ES",
    language: "Spanish",
    blurb: "Who gets the water when there isn't enough.",
    pieces: [
      piece("de-donde-sale-el-agua", "De dónde sale el agua que bebes", "Reservoirs, rivers and a lot of pipes.", "explainer"),
      piece("campos-de-golf", "¿Golf y piscinas en zona de sequía?", "Tourism, farming and taps, same reservoir.", "debate"),
      piece("un-pueblo-sin-agua", "El pueblo que se quedó sin grifo", "Water arrived by truck for months.", "portrait"),
    ],
  },
];

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
    topic.pieces.map((piece) => ({ topic, piece }))
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
      .sort((a, b) => Number(b.piece.body.length > 0) - Number(a.piece.body.length > 0)),
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
  slug: string
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
