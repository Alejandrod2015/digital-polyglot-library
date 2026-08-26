import germanExpat from "@/data/tapGlosses/german-expat.json";
import germanHamburg from "@/data/tapGlosses/german-hamburg.json";
import germanFriends from "@/data/tapGlosses/german-friends.json";
import frenchTraveler from "@/data/tapGlosses/french-traveler.json";
import frenchExpatLyon from "@/data/tapGlosses/french-expat-lyon.json";
import spanishFriends from "@/data/tapGlosses/spanish-friends.json";
import spanishTravelerLatam from "@/data/tapGlosses/spanish-traveler-latam.json";
import spanishFriendsColombia from "@/data/tapGlosses/spanish-friends-colombia.json";
import spanishFriendsArgentina from "@/data/tapGlosses/spanish-friends-argentina.json";
import spanishFriendsSpainA0 from "@/data/tapGlosses/spanish-friends-spain-a0.json";
import spanishTravelerMexicoA0 from "@/data/tapGlosses/spanish-traveler-mexico-a0.json";
import spanishTravelerSpainA2 from "@/data/tapGlosses/spanish-traveler-spain-a2.json";
import spanishFriendsMexico from "@/data/tapGlosses/spanish-friends-mexico.json";
import italianFriendsA0 from "@/data/tapGlosses/italian-friends-a0.json";
import germanTravelerA0 from "@/data/tapGlosses/german-traveler-a0.json";
import portugueseTravelerBrazilA0 from "@/data/tapGlosses/portuguese-traveler-brazil-a0.json";
import portugueseTravelerBrazilA1 from "@/data/tapGlosses/portuguese-traveler-brazil-a1.json";
import italianTravelerA0 from "@/data/tapGlosses/italian-traveler-a0.json";
// Talking Points. Same contract as a journey bundle, split by language because
// the key is the bare surface form and the two languages collide on it: "bar"
// is a Spanish noun and a German adverb, "in" and "man" likewise.
import talkingPointsEs from "@/data/tapGlosses/talking-points-es.json";
import talkingPointsDe from "@/data/tapGlosses/talking-points-de.json";

// Piloto "tap any word" (2026-07-06): glosses contextuales autorados por
// historia/journey, precomputados en el repo. El reader envuelve cada
// palabra con gloss en un span tapeable; las 20-25 curadas del vocab[]
// siguen intactas como pills (capa de enseñanza). Este archivo decide
// qué historias participan; hoy solo el journey Expat alemán C1.
//
// Cada entrada: { g: gloss en inglés, t: tipo gramatical } donde t usa las
// mismas claves que el vocab curado (verb|noun|adjective|adverb|pronoun|
// preposition|conjunction|article|number|expression|other) para reusar los colores
// de badge y clasificar bien los favoritos guardados desde el diccionario.
// `c` y `f` son la capa de CONTEXTO, y solo existen dentro de `byStory`: la
// misma palabra no significa lo mismo en dos historias ("baja del tren" no es
// "baja la voz"), así que el trozo traducido y sus formas tienen que colgar de
// la historia, no del journey. `glosses` sigue siendo el mapa global
// de toda la vida y es el que se usa cuando una historia no tiene capa propia.
export type TapGloss = {
  g: string;
  t: string;
  r?: string;
  /** El trozo mínimo con sentido alrededor de la palabra, en la lengua de la
   *  historia y en inglés. "baja" -> { es: "baja del tren", en: "gets off the train" }. */
  c?: { es: string; en: string };
  /** Las FORMAS de la palabra, que es lo que se enseña en vez de explicarla:
   *  la conjugación de un verbo, la concordancia de un adjetivo, el artículo y
   *  el plural de un sustantivo, el paradigma de un pronombre. Las palabras que
   *  no se declinan (adverbios, preposiciones) traen tres usos reales. `rows`
   *  son pares [etiqueta, forma]; `here` marca cuál sale en esta historia, y es
   *  la que la tarjeta enciende. Ausente en los nombres propios, que no enseñan
   *  nada y dejan la tarjeta en dos líneas. */
  /** Marca de género para los sustantivos ("m." / "f."), pegada a la palabra
   *  como en un diccionario. Es lo único que el distintivo de tipo no dice, y
   *  `el` no se lo dice a quien viene del inglés. */
  gm?: string;
  f?: {
    label?: string;
    /** "line": las formas que FALTAN, siempre a la vista y sin desplegable (el
     *  plural de un sustantivo, las otras concordancias de un adjetivo). Nunca
     *  repite la que ya sale en el trozo de arriba.
     *  "expand": no enseña nada de entrada y el enlace nombra lo que hay detrás
     *  ("See conjugation"), que se despliega dentro de la tarjeta. */
    kind?: "line" | "expand";
    /** Texto del enlace en las de tipo "expand". */
    link?: string;
    rows: string[][];
    /** Índice de la forma que sale en la historia, para encenderla al
     *  desplegar. -1 cuando esa forma no está en la lista, que es lo normal en
     *  las de tipo "line" desde que no se repite. */
    here: number;
  };
};

type TapGlossBundle = {
  slugs: string[];
  glosses: Record<string, TapGloss>;
  byStory?: Record<string, Record<string, TapGloss>>;
};

const BUNDLES: TapGlossBundle[] = [
  germanExpat as TapGlossBundle,
  germanHamburg as TapGlossBundle,
  germanFriends as TapGlossBundle,
  frenchTraveler as TapGlossBundle,
  frenchExpatLyon as TapGlossBundle,
  spanishFriends as TapGlossBundle,
  spanishTravelerLatam as TapGlossBundle,
  spanishFriendsColombia as TapGlossBundle,
  spanishFriendsArgentina as TapGlossBundle,
  spanishFriendsSpainA0 as TapGlossBundle,
  spanishTravelerMexicoA0 as TapGlossBundle,
  spanishTravelerSpainA2 as TapGlossBundle,
  spanishFriendsMexico as TapGlossBundle,
  italianFriendsA0 as TapGlossBundle,
  germanTravelerA0 as TapGlossBundle,
  portugueseTravelerBrazilA0 as TapGlossBundle,
  portugueseTravelerBrazilA1 as TapGlossBundle,
  italianTravelerA0 as TapGlossBundle,
  talkingPointsEs as TapGlossBundle,
  talkingPointsDe as TapGlossBundle,
];

export function getTapGlossesForSlug(slug: string): Record<string, TapGloss> | null {
  for (const bundle of BUNDLES) {
    if (!bundle.slugs.includes(slug)) continue;
    const perStory = bundle.byStory?.[slug];
    // La capa de la historia pisa a la global palabra a palabra, y las que no
    // tenga se quedan con la glosa de siempre; así una historia se puede subir
    // a la capa de contexto sin tocar las otras veinte del journey.
    return perStory ? { ...bundle.glosses, ...perStory } : bundle.glosses;
  }
  return null;
}
