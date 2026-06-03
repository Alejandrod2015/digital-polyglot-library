/**
 * Recurring casts per journey, organized by country.
 *
 * Cada journey contiene múltiples familias / mini-casts, uno por país.
 * El recurring-character bonding (Duolingo Stories Zari/Lily pattern, ver
 * docs/engagement-research-brief.pdf) ocurre DENTRO de cada mini-cast,
 * no a través del journey entero. Es decir: las stories de Bogotá comparten
 * cast colombiano; las stories de Cuenca comparten cast ecuatoriano; etc.
 *
 * Esto permite que el journey "Spanish LATAM" represente la diversidad real
 * del continente sin forzar a una sola familia a viajar por 5 países.
 *
 * Cuando un worker diseña una story nueva, debe:
 *   1. Elegir el país (decisión editorial / scenario).
 *   2. Usar el mini-cast existente de ese país wherever possible.
 *   3. Solo inventar un nuevo nombre cuando la story lo requiere genuinamente.
 *   4. Si el país aún no tiene mini-cast definido aquí, este archivo crece.
 */

import { SPANISH_DIALOGUE_VOICES, GERMAN_DIALOGUE_VOICES } from "@/lib/elevenlabs";

export type CastMember = {
  /** Internal identifier, kebab-case. */
  slug: string;
  /** Name as it appears in the story body (Speaker label). */
  displayName: string;
  /** ElevenLabs voiceId. */
  voiceId: string;
  /** Voice slot name (matches SPANISH_DIALOGUE_VOICES key). */
  voiceSlot: string;
  age: "young" | "middle-aged" | "old";
  relation: string;
  description: string;
};

export type CountryCast = {
  country: string;
  city?: string;
  members: CastMember[];
  /** Optional through-line / emotional subtext that runs across this country's stories. */
  notes?: string;
  /** Existing published seeds in this mini-cast (story slugs). */
  seedStories?: string[];
};

export type JourneyCast = {
  /** Key format: "<language>-<variant>", lowercase. */
  journeyKey: string;
  countries: CountryCast[];
  notes: string;
};

/**
 * Spanish (LATAM) journey: familias diversas en distintos países del continente.
 *
 * Cada país tiene su propio mini-cast estable. Las stories pueden saltar
 * entre países, pero cada story usa el cast del país en el que está
 * ambientada (no se mezclan personajes entre países a menos que haya un
 * viaje o llamada explícita).
 */
// Países canónicos del plan: Colombia, Argentina, México, Perú, Chile.
// Cualquier story v2-2026-06 nueva debe ambientarse en uno de estos 5.
//
// Notas sobre legacy: las historias "Una pizca de canela" (Cuenca, Ecuador)
// y "El control no funciona" (Montevideo, Uruguay) son v2 cohort pero
// ambientadas fuera de los 5 canónicos. Quedan como stand-alones de
// arranque; sus personajes (Lucía/Daniela, Beatriz/Mateo) NO son cast
// recurrente del journey y no deben reusarse en stories nuevas.
export const SPANISH_LATAM_CAST: JourneyCast = {
  journeyKey: "spanish-latam",
  countries: [
    {
      country: "Colombia",
      city: "Bogotá",
      members: [
        {
          slug: "marina",
          displayName: "Marina",
          voiceId: SPANISH_DIALOGUE_VOICES.luna,
          voiceSlot: "luna",
          age: "young",
          relation: "Hija de Don Hernán, 28-30 años.",
          description: "Anchor del mini-cast colombiano. Curiosa, observadora. Visita a su papá los domingos.",
        },
        {
          slug: "don-hernan",
          displayName: "Don Hernán",
          voiceId: SPANISH_DIALOGUE_VOICES.horacio,
          voiceSlot: "horacio",
          age: "middle-aged",
          relation: "Padre viudo de Marina, 58-65 años.",
          description: "Anchor secundario colombiano. Procesa la ausencia de su esposa en silencio.",
        },
        {
          slug: "dona-rosa",
          displayName: "Doña Rosa",
          voiceId: SPANISH_DIALOGUE_VOICES.angela,
          voiceSlot: "angela",
          age: "middle-aged",
          relation: "Vecina del edificio de Don Hernán.",
          description: "Bogotá local secundaria. Trae comida, chismes, ayuda.",
        },
      ],
      notes: "Familia López, Bogotá. Through-line: el duelo silencioso de Don Hernán por su esposa, observado por Marina sin que ninguno lo nombre.",
      seedStories: ["domingo-con-papa"],
    },
    {
      country: "México",
      city: "CDMX (Coyoacán)",
      members: [
        {
          slug: "sofia",
          displayName: "Sofía",
          voiceId: SPANISH_DIALOGUE_VOICES.cindy,
          voiceSlot: "cindy",
          age: "young",
          relation: "Sobrina de Tío Beto. Vive en CDMX. Visita la fonda casi a diario.",
          description: "Anchor mexicano. 27-30 años. Su mamá murió hace años; reconstruye memoria a través de la comida familiar.",
        },
        {
          slug: "tio-beto",
          displayName: "Tío Beto",
          voiceId: SPANISH_DIALOGUE_VOICES.emilio,
          voiceSlot: "emilio",
          age: "middle-aged",
          relation: "Tío de Sofía. Dueño de una fonda pequeña en Coyoacán.",
          description: "Hermano de la mamá difunta de Sofía. Guarda recetas, cuentos, fotos. Anchor secundario MX.",
        },
        {
          slug: "mateo",
          displayName: "Mateo",
          voiceId: SPANISH_DIALOGUE_VOICES.tom,
          voiceSlot: "tom",
          age: "young",
          relation: "Primo de Sofía. Ayuda en la fonda los fines de semana.",
          description: "20-22 años. Vibra de hermano menor. Aprende los oficios del Tío Beto.",
        },
        {
          slug: "lupita",
          displayName: "Lupita",
          voiceId: SPANISH_DIALOGUE_VOICES.ana_sofia,
          voiceSlot: "ana_sofia",
          age: "young",
          relation: "Clienta regular de la fonda; conocía a la mamá de Sofía.",
          description: "Amiga del barrio. Vive cerca. Trae historias de la generación pasada.",
        },
      ],
      notes: "Familia Hernández y la fonda de Tío Beto en Coyoacán. Through-line: la mamá de Sofía está presente en cada plato y memoria sin que nadie la nombre directamente al inicio.",
    },
    {
      country: "Argentina",
      city: "Buenos Aires (Palermo)",
      members: [
        {
          slug: "camila",
          displayName: "Camila",
          voiceId: SPANISH_DIALOGUE_VOICES.roma,
          voiceSlot: "roma",
          age: "middle-aged",
          relation: "Recién llegada al edificio. Viene de una ciudad chica del interior.",
          description: "Anchor rioplatense. 32-35 años. Casual conversacional. Busca empezar de nuevo en BA.",
        },
        {
          slug: "tomas",
          displayName: "Tomás",
          voiceId: SPANISH_DIALOGUE_VOICES.renzo,
          voiceSlot: "renzo",
          age: "young",
          relation: "Vecino joven en el mismo edificio.",
          description: "26-29 años. También recién llegado. Tiene curiosidad por Camila pero respeta espacios.",
        },
        {
          slug: "dona-sara",
          displayName: "Doña Sara",
          voiceId: SPANISH_DIALOGUE_VOICES.nieve,
          voiceSlot: "nieve",
          age: "old",
          relation: "Encargada / portera del edificio en Palermo.",
          description: "Vive ahí hace 40 años. Conoce a todos los inquilinos. Ofrece presencia más que consejo.",
        },
      ],
      notes: "Edificio en Palermo, Buenos Aires. Through-line: dos personas nuevas en el mismo lugar al mismo tiempo, observadas por una tercera que lleva décadas. Por regla del proyecto, los personajes hablan con tú forms (no voseo) aunque la ambientación sea rioplatense.",
    },
    // Perú y Chile: voces aprobadas en SPANISH_DIALOGUE_VOICES (elena/joselo, catalina/vicente/angela_cl).
    // Cast por diseñar al producir la primera story de cada país.
  ],
  notes:
    "Journey con 5 países canónicos: Colombia (Bogotá), Argentina, México, Perú, Chile. Cada uno tendrá su propio mini-cast estable. Solo Colombia tiene cast definido por ahora. Historias nuevas v2 deben ambientarse en uno de los 5 y usar el cast del país correspondiente. Las stories legacy (Una pizca de canela en Ecuador, El control no funciona en Uruguay) viven como stand-alones; sus personajes NO son cast recurrente del journey.",
};

/**
 * German conversational journey — 3 mini-casts (Berlin / München / Hamburg),
 * each anchored to one of the 3 beta topics. Cast designed June 2026 against
 * the 10 approved German dialogue voices (4 original + 6 added in voice
 * audit rounds). Topic→city mapping:
 *   - home-family       → Berlin (Onkel Klaus + Frau Schmidt + Maja)
 *   - meeting-new-people→ München (Lena + Stefan + Oma Hilde)
 *   - food-everyday-life→ Hamburg (Jonas + Frau Becker + Herr Hoffmann)
 */
export const GERMAN_TRAVELER_CAST: JourneyCast = {
  journeyKey: "german-germany",
  countries: [
    {
      country: "Germany",
      city: "Berlin (Kreuzberg)",
      members: [
        {
          slug: "maja",
          displayName: "Maja",
          voiceId: GERMAN_DIALOGUE_VOICES.ela_calm,
          voiceSlot: "ela_calm",
          age: "young",
          relation: "Sobrina de Onkel Klaus, ~28 años. Vive en Kreuzberg.",
          description: "Anchor protagonista de Berlin. Visita a su tío con frecuencia. Curiosa, observadora.",
        },
        {
          slug: "onkel-klaus",
          displayName: "Onkel Klaus",
          voiceId: GERMAN_DIALOGUE_VOICES.moritz,
          voiceSlot: "moritz",
          age: "old",
          relation: "Tío de Maja, ~60 años. Viudo. Vive solo en Kreuzberg desde hace décadas.",
          description: "Anchor secundario Berlin. Procesa la ausencia de su esposa en silencio.",
        },
        {
          slug: "frau-schmidt",
          displayName: "Frau Schmidt",
          voiceId: GERMAN_DIALOGUE_VOICES.eleonore,
          voiceSlot: "eleonore",
          age: "old",
          relation: "Vecina del edificio de Onkel Klaus, ~65 años.",
          description: "Anchor terciario Berlin. Trae comida, chismes del barrio, presencia silenciosa.",
        },
      ],
      notes: "Familia + vecindad Kreuzberg. Through-line: el duelo silencioso de Onkel Klaus por su esposa, observado por Maja sin que ninguno lo nombre.",
    },
    {
      country: "Germany",
      city: "München (Schwabing)",
      members: [
        {
          slug: "lena",
          displayName: "Lena",
          voiceId: GERMAN_DIALOGUE_VOICES.ela_warm,
          voiceSlot: "ela_warm",
          age: "young",
          relation: "Joven profesional recién mudada a Schwabing, ~29 años.",
          description: "Anchor protagonista München. Acaba de empezar trabajo nuevo. Conoce gente.",
        },
        {
          slug: "stefan",
          displayName: "Stefan",
          voiceId: GERMAN_DIALOGUE_VOICES.felix,
          voiceSlot: "felix",
          age: "middle-aged",
          relation: "Colega del trabajo de Lena, ~38 años.",
          description: "Anchor secundario München. Casado, dos hijos. Amable, profesional.",
        },
        {
          slug: "oma-hilde",
          displayName: "Oma Hilde",
          voiceId: GERMAN_DIALOGUE_VOICES.jane,
          voiceSlot: "jane",
          age: "old",
          relation: "Abuela de Lena que visita ocasionalmente desde el campo, ~70 años.",
          description: "Anchor terciario München. Cariñosa, observadora. Su visita trae perspectiva generacional.",
        },
      ],
      notes: "Vida joven profesional en Schwabing. Through-line: Lena navega el primer año en la ciudad, balanceando trabajo nuevo, vida social y la presencia ocasional de su abuela.",
    },
    {
      country: "Germany",
      city: "Hamburg (Eppendorf)",
      members: [
        {
          slug: "jonas",
          displayName: "Jonas",
          voiceId: GERMAN_DIALOGUE_VOICES.michael,
          voiceSlot: "michael",
          age: "young",
          relation: "Estudiante / joven trabajador en Eppendorf, ~26 años.",
          description: "Anchor protagonista Hamburg. Cocina sencillo en casa, frecuenta el mercado.",
        },
        {
          slug: "frau-becker",
          displayName: "Frau Becker",
          voiceId: GERMAN_DIALOGUE_VOICES.enniah,
          voiceSlot: "enniah",
          age: "middle-aged",
          relation: "Casera del edificio de Jonas, ~50 años.",
          description: "Anchor secundario Hamburg. Cálida, ayuda a Jonas con consejos prácticos y recetas.",
        },
        {
          slug: "herr-hoffmann",
          displayName: "Herr Hoffmann",
          voiceId: GERMAN_DIALOGUE_VOICES.daniel,
          voiceSlot: "daniel",
          age: "old",
          relation: "Pescadero del mercado local en Eppendorf, ~65 años.",
          description: "Anchor terciario Hamburg. Cara conocida del barrio. Recuerda a Jonas a su propio abuelo.",
        },
      ],
      notes: "Vida cotidiana en Hamburg. Through-line: Jonas aprende a cuidarse solo (cocinar, comprar, vivir en la ciudad) con ayuda de figuras familiares-no-familiares.",
    },
  ],
  notes:
    "Beta inicial: 3 ciudades alemanas (Berlin/München/Hamburg) × 3 anchors estables cada una, 1 voz spare (Marius). 21 stories totales (3 topics × 7) al nivel A1. Cada topic ambientado en una ciudad específica con su mini-cast: home-family→Berlin, meeting-new-people→München, food-everyday-life→Hamburg.",
};

/** Indexed by journey key for lookup. */
export const JOURNEY_CASTS: Record<string, JourneyCast> = {
  "spanish-latam": SPANISH_LATAM_CAST,
  "german-germany": GERMAN_TRAVELER_CAST,
};

export function getJourneyCast(
  language: string,
  variant: string
): JourneyCast | null {
  const key = `${language.toLowerCase()}-${variant.toLowerCase()}`;
  return JOURNEY_CASTS[key] ?? null;
}

/** All cast members across all countries in a journey. */
export function getAllCastMembers(cast: JourneyCast): CastMember[] {
  return cast.countries.flatMap((c) => c.members);
}

/** Cast members for a specific country within a journey. */
export function getCountryCast(
  cast: JourneyCast,
  country: string
): CountryCast | null {
  const target = country.toLowerCase();
  return cast.countries.find((c) => c.country.toLowerCase() === target) ?? null;
}
