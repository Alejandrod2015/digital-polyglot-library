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
 *
 * Los elencos son POR JOURNEY, no por nivel. Cuando el journey suba a A2,
 * B1, etc., las stories nuevas REUSAN los mismos personajes (Jonas, Lena,
 * Maja, etc.), que crecen con el alumno como en una serie. No inventar
 * elencos nuevos por nivel. Escalar por profundidad (más historias + arcos
 * que evolucionan + secundarios rotativos), no por más ciudades: el pool
 * de voces es limitado (~10 por idioma) y 3 mini-casts ya usan casi todo.
 * Contras a manejar al escribir: evitar monotonía (hacer evolucionar
 * relaciones/situaciones) y cuidar coherencia (edades, parentescos, pasado).
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
          relation: "Hermana mayor de Julián; comparten apartamento en Bogotá.",
          description: "Anchor del mini-cast colombiano. La sensata de los dos; cede ante una buena carita de perro.",
        },
        {
          slug: "julian",
          displayName: "Julián",
          // juan (CO M young): reusa la voz de Andrés (Cartagena); no coinciden
          // nunca en escena (temas distintos). horacio quedó libre.
          voiceId: SPANISH_DIALOGUE_VOICES.juan,
          voiceSlot: "juan",
          age: "young",
          relation: "Hermano menor de Marina; impulsivo y de buen corazón.",
          description: "Rescata un perro callejero bajo la lluvia y lo mete a escondidas al apartamento.",
        },
        {
          slug: "mama",
          displayName: "Mamá",
          voiceId: SPANISH_DIALOGUE_VOICES.lina_botero,
          voiceSlot: "lina_botero",
          age: "middle-aged",
          relation: "Mamá de Marina y Julián; los visita los domingos.",
          description: "Cálida, no severa. Aparece en la 3 y termina aceptando al perro (de niña tuvo uno igual). NO es sabia folclórica: es una mamá normal.",
        },
      ],
      notes: "Familia en Bogotá. Cast peer/nativo: dos hermanos jóvenes (Marina + Julián) + su mamá. Arco home-family: Julián mete a escondidas un perro callejero rescatado de la lluvia; lo esconden del vecino; la mamá llega el domingo y termina aceptándolo (lo llaman Lluvia). Don Hernán y Doña Rosa (tech-comedia de mayores) ELIMINADOS 2026-06-10 (de-sesgo); voz horacio liberada. Vecino = one-off (puede usar horacio).",
    },
    {
      country: "México",
      city: "Ciudad de México",
      members: [
        {
          slug: "sofia",
          displayName: "Sofía",
          voiceId: SPANISH_DIALOGUE_VOICES.ana_sofia,
          voiceSlot: "ana_sofia",
          age: "young",
          relation: "Anchor mexicano. Comparte departamento con Renata en la Ciudad de México.",
          description: "27-30 años. Optimista y un poco impulsiva: promete más de lo que sabe cocinar. Le gusta Pablo.",
        },
        {
          slug: "renata",
          displayName: "Renata",
          // ana_maria (MX es-MX, young F, calm/natural): distinct from Sofía
          // (ana_sofia). Elegida 2026-06-10 tras A/B en la línea real;
          // reemplaza a cindy y zetian (ambas rechazadas al oído). Roommate
          // two-handers son constantes, así que voz distinta es obligatoria.
          voiceId: SPANISH_DIALOGUE_VOICES.ana_maria,
          voiceSlot: "ana_maria",
          age: "young",
          relation: "Compañera de piso de Sofía. La voz de la razón del departamento.",
          description: "26-29 años. Sarcástica y práctica; sí sabe cocinar y lo recuerda seguido.",
        },
        {
          slug: "mateo",
          displayName: "Mateo",
          voiceId: SPANISH_DIALOGUE_VOICES.tom,
          voiceSlot: "tom",
          age: "young",
          relation: "Amigo de Sofía y Renata. Siempre de visita en el departamento.",
          description: "20-22 años. Caótico pero resolutivo; su superpoder es pedir comida a domicilio.",
        },
        {
          slug: "pablo",
          displayName: "Pablo",
          // emilio (MX M): liberado de Tío Beto (eliminado). Rol secundario
          // (el chico que le gusta a Sofía); distinto de Mateo (tom).
          voiceId: SPANISH_DIALOGUE_VOICES.emilio,
          voiceSlot: "emilio",
          age: "middle-aged",
          relation: "Amigo del grupo; el chico que a Sofía le gusta.",
          description: "El más bromista de los invitados. Aparece en la cena.",
        },
      ],
      notes: "Comida en la Ciudad de México. Cast peer/relatable: Sofía + su compañera de piso Renata + sus amigos Mateo y Pablo. Tono: comedia de cocina moderna (cocinar para amigos = desastre cómico; depto, video-receta, alarma de humo, pedir tacos). Tío Beto y Lupita ELIMINADOS 2026-06-10 (folclore/elder fuera por pedido del usuario); sus voces (emilio, azu) reutilizables.",
    },
    {
      country: "Argentina",
      city: "Buenos Aires",
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
      ],
      notes: "Edificio en Palermo, Buenos Aires. Cast peer/nativo: Camila (a punto de rendirse y volver a su pueblo) + Tomás. Arco con pregunta dramática real (rediseñado 2026-06-10, antes eran 3 charlas sin stake): Camila ya casi se vuelve a Tandil → una caja mal entregada la cruza con Tomás → él la convence de quedarse, y descubren que son del mismo pueblo (Tandil) → domingo, casi se va (cree que Tomás solo fue amable), él la alcanza, ella decide quedarse por sí misma. Slugs: una-caja-y-una-maleta / del-mismo-pueblo / el-micro-del-domingo. Doña Sara (portera celestina) ELIMINADA; voz nieve libre. Camila y Tomás hablan en VOSEO auténtico (vos/sos/tenés/querés/mirá/esperá/con vos) por ser porteños. CORREGIDO 2026-06-10: la regla de español neutro (no voseo) es SOLO para hablar con el usuario, NO para el contenido; una historia en Argentina con porteños en 'tú' es falsa y rompe la tesis de lenguaje auténtico.",
    },
    {
      country: "Colombia",
      city: "Cartagena",
      members: [
        {
          slug: "daniela",
          displayName: "Daniela",
          voiceId: SPANISH_DIALOGUE_VOICES.carito,
          voiceSlot: "carito",
          age: "young",
          relation: "Joven del barrio que ayuda a organizar la fiesta de la calle.",
          description: "Anchor de Cartagena. Curiosa por las tradiciones del barrio.",
        },
        {
          slug: "andres",
          displayName: "Andrés",
          voiceId: SPANISH_DIALOGUE_VOICES.juan,
          voiceSlot: "juan",
          age: "young",
          relation: "Vecino y amigo de Daniela.",
          description: "Práctico, alegre. Carga sillas, cuelga luces, hace de todo.",
        },
      ],
      notes: "Tema: Fiestas y comunidad (community-celebrations), Cartagena. Cast peer/nativo: Daniela + Andrés, dos amigos jóvenes que organizan la fiesta de la calle. Arco: nadie sabe dirigir la cumbia (Don Tomás, referido, está enfermo), así que la sacan ellos mismos de un video del año pasado; obstáculo cómico (Andrés sin ritmo) + lluvia la noche antes + triunfo en la fiesta. Doña Carmen (la matriarca que enseña) ELIMINADA 2026-06-10 (de-sesgo viejo-sabio; la tradición se transmite peer-to-peer y por la comunidad, no recitada por una mayor); voz maria_blanco liberada.",
    },
    {
      country: "Perú",
      city: "Lima",
      members: [
        {
          slug: "pilar",
          displayName: "Pilar",
          voiceId: SPANISH_DIALOGUE_VOICES.sabina,
          voiceSlot: "sabina",
          age: "young",
          relation: "Recién llegada a Lima; aprende a moverse por la ciudad.",
          description: "Anchor de Lima. Se pierde, pregunta, descubre la ciudad de a poco.",
        },
        {
          slug: "diego",
          displayName: "Diego",
          voiceId: SPANISH_DIALOGUE_VOICES.terry,
          voiceSlot: "terry",
          age: "young",
          relation: "Conocido que ayuda a Pilar con direcciones y transporte.",
          description: "Limeño de toda la vida. Tranquilo, servicial.",
        },
        {
          slug: "beto",
          displayName: "Beto",
          voiceId: SPANISH_DIALOGUE_VOICES.joselo,
          voiceSlot: "joselo",
          age: "young",
          relation: "Chofer joven de combi, amigo de Diego; conoce a todos en la ruta.",
          description: "Resuelve el caper de la carpeta llamando a sus patas de la ruta. Reemplazó a Don Óscar 2026-06-10 (de-sesgo viejo-sabio).",
        },
        {
          slug: "carmen",
          displayName: "Carmen",
          voiceId: SPANISH_DIALOGUE_VOICES.elena,
          voiceSlot: "elena",
          age: "middle-aged",
          relation: "Jefa del área; entrevista a Pilar. Invitada, solo en la historia 3.",
          description: "Profesional, elegante y justa. Encontró la carpeta de Pilar y resultó ser su entrevistadora. Voz elena (peruana es-PE), elegida 2026-06-10.",
        },
      ],
      notes: "Tema: Lugares y transporte (places-getting-around), Lima. Cast peer/nativo: Pilar (recién llegada del campo) + Diego + Beto (chofer joven). Arco: caper de la carpeta perdida en la combi equivocada; la encuentra su futura jefa (Carmen, invitada). Don Óscar ELIMINADO 2026-06-10. Carmen aparece solo en la 3 (no recurrente).",
    },
    {
      country: "Chile",
      city: "Patagonia (sur de Chile)",
      members: [
        {
          slug: "javiera",
          displayName: "Javiera",
          voiceId: SPANISH_DIALOGUE_VOICES.catalina,
          voiceSlot: "catalina",
          age: "young",
          relation: "Joven que vuelve al sur a visitar a su familia.",
          description: "Anchor del sur. Reconecta con el lugar donde creció.",
        },
        {
          slug: "benjamin",
          displayName: "Benjamín",
          voiceId: SPANISH_DIALOGUE_VOICES.vicente,
          voiceSlot: "vicente",
          age: "young",
          relation: "Amigo/primo que conoce los cerros y lagos.",
          description: "Aventurero tranquilo. Guía las caminatas.",
        },
        {
          slug: "gloria",
          displayName: "Gloria",
          voiceId: SPANISH_DIALOGUE_VOICES.angela_cl,
          voiceSlot: "angela_cl",
          age: "middle-aged",
          relation: "Madre/tía que se quedó en el sur.",
          description: "Anchor secundaria. Guarda la memoria del lugar y de la familia.",
        },
      ],
      notes: "Tema: Naturaleza y aventura (nature-adventure), la Patagonia chilena. Tono: aventura/comedia (viaje en kayak a una isla; el kayak se va; rescate de Gloria), no nostalgia.",
    },
    {
      country: "México",
      city: "Oaxaca",
      members: [
        {
          slug: "itzel",
          displayName: "Itzel",
          voiceId: SPANISH_DIALOGUE_VOICES.ana_maria,
          voiceSlot: "ana_maria",
          age: "young",
          relation: "Joven oaxaqueña escéptica y resuelta; quiere explicaciones reales, no cuentos.",
          description: "Anchor de Oaxaca. No cree en el duende del patio y decide resolver el misterio.",
        },
        {
          slug: "rodrigo",
          displayName: "Rodrigo",
          voiceId: SPANISH_DIALOGUE_VOICES.patricio,
          voiceSlot: "patricio",
          age: "young",
          relation: "Amigo de Itzel; cree en la leyenda del duende que le contaba su abuela.",
          description: "Creyente y un poco miedoso; aporta el color cultural de la leyenda (referida, no recitada por un mayor en escena).",
        },
      ],
      notes: "Tema: Leyendas y cultura (legends-folklore), Oaxaca. Cast peer/nativo: Itzel (escéptica) + Rodrigo (amigo creyente). Through-line cómico: el misterio del duende del patio que resulta ser una mamá tlacuache con crías. Doña Elvira ELIMINADA 2026-06-10 (cliché viejo-sabio folclórico fuera; voz esme liberada). La leyenda sobrevive como cultura referida (la abuela de Rodrigo), no recitada en escena.",
    },
  ],
  notes:
    "Reestructura 7 temas × 3 historias (2026-06-09). 7 mini-casts por ciudad: Ciudad de México (comida), Bogotá (casa y familia), Buenos Aires (conocer gente), Cartagena (fiestas y comunidad), Lima (lugares y transporte), Patagonia/Chile (naturaleza y aventura), Oaxaca (leyendas y cultura). Narrador único journey-wide = andreti. Historias nuevas v2 usan el cast del país/tema correspondiente. Las stories legacy (Una pizca de canela en Ecuador, El control no funciona en Uruguay) viven como stand-alones; sus personajes NO son cast recurrente del journey.",
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
        {
          slug: "kollegin",
          displayName: "Kollegin",
          voiceId: GERMAN_DIALOGUE_VOICES.ela_calm,
          voiceSlot: "ela_calm",
          age: "young",
          relation: "Otra colega del trabajo de Lena, ~30 años.",
          description: "Bit role (aparece solo en der-erste-tag). Voz ela_calm reusada de Maja (Berlín, otro cast); no coinciden en esa historia.",
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
        {
          slug: "frau-hoffmann",
          displayName: "Frau Hoffmann",
          voiceId: GERMAN_DIALOGUE_VOICES.eleonore,
          voiceSlot: "eleonore",
          age: "old",
          relation: "Esposa de Herr Hoffmann (Werner), ~65 años.",
          description: "Secundaria recurrente Hamburg. Voz eleonore reusada de Frau Schmidt (Berlín); nunca coinciden (casts distintos por ciudad).",
        },
        {
          slug: "baeckerin",
          displayName: "Bäckerin",
          voiceId: GERMAN_DIALOGUE_VOICES.enniah,
          voiceSlot: "enniah",
          age: "middle-aged",
          relation: "Panadera del barrio de Jonas, ~50 años.",
          description: "Bit role (aparece solo en brot-am-morgen). Voz enniah reusada de Frau Becker; no coinciden en esa historia.",
        },
        {
          slug: "eine-frau",
          displayName: "Eine Frau",
          voiceId: GERMAN_DIALOGUE_VOICES.eleonore,
          voiceSlot: "eleonore",
          age: "middle-aged",
          relation: "Transeúnte anónima en el mercado, una sola línea.",
          description: "Bit role (aparece solo en der-erste-markt, indica dónde está el pescado). Voz eleonore; no coinciden Frau Schmidt/Frau Hoffmann en esa historia.",
        },
      ],
      notes: "Vida cotidiana en Hamburg. Through-line: Jonas aprende a cuidarse solo (cocinar, comprar, vivir en la ciudad) con ayuda de figuras familiares-no-familiares.",
    },
  ],
  notes:
    "Beta inicial: 3 ciudades alemanas (Berlin/München/Hamburg) × 3 anchors estables cada una + roles menores (Frau Hoffmann secundaria; Bäckerin y Kollegin bit roles de una escena). 21 stories totales (3 topics × 7) al nivel A1. Cada topic ambientado en una ciudad específica: home-family→Berlin, meeting-new-people→München, food-everyday-life→Hamburg. Voces: las 9 anchors usan 9 slots; el único slot libre es Marius (MASCULINO), así que NO hay voz femenina libre — los roles femeninos menores reusan voces femeninas existentes garantizando que no choquen dentro de la misma historia. Si en el futuro se necesitan más mujeres distintas, hace falta sumar una voz femenina DE al pool. NARRADOR del journey = `gjango` (GERMAN_DIALOGUE_VOICES), elegido 2026-06-05 en reemplazo de Marius (que no gustó). Al regenerar audio, voiceMap.narrator = GERMAN_DIALOGUE_VOICES.gjango.",
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
