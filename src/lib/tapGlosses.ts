import "server-only";
import { prisma } from "@/lib/prisma";

// Piloto "tap any word" (2026-07-06): glosses contextuales autorados por
// historia/journey. El reader envuelve cada palabra con gloss en un span
// tapeable; las 20-25 curadas del vocab[] siguen intactas como pills (capa de
// enseñanza).
//
// DONDE VIVEN (cambiado el 2026-08-26). Hasta hoy, en `src/data/tapGlosses/*.json`
// importados aqui, o sea EMPAQUETADOS EN EL BUILD: cambiar una glosa exigia un
// build de Vercel y el JSON iba por 2,5 MB con solo 2 de 18 journeys hechos.
// Ahora viven en la tabla `dp_tap_glosses_v1`, como el texto de la historia, su
// vocabulario y su audio. Escribir la capa de un journey es una escritura en la
// base y se ve al instante.
//
// Cada entrada: { g: gloss en inglés, t: tipo gramatical } donde t usa las
// mismas claves que el vocab curado (verb|noun|adjective|adverb|pronoun|
// preposition|conjunction|article|number|expression|other) para reusar los
// colores de badge y clasificar bien los favoritos guardados desde el
// diccionario. `c` y `f` son la capa de CONTEXTO y solo existen en la fila de
// la HISTORIA: la misma palabra no significa lo mismo en dos ("baja del tren"
// no es "baja la voz"), asi que el trozo traducido y sus formas cuelgan de la
// historia, no del journey. La fila de slug "" es el mapa global del bundle y
// es el que se usa cuando una historia no tiene capa propia.
export type TapGloss = {
  g: string;
  t: string;
  r?: string;
  /** El trozo mínimo con sentido alrededor de la palabra, en la lengua de la
   *  historia y en inglés. "baja" -> { es: "baja del tren", en: "gets off the train" }. */
  c?: { es: string; en: string };
  /** Marca de género para los sustantivos ("m." / "f."), pegada a la palabra
   *  como en un diccionario. Es lo único que el distintivo de tipo no dice, y
   *  `el` no se lo dice a quien viene del inglés. */
  gm?: string;
  /** Las FORMAS de la palabra, que es lo que se enseña en vez de explicarla:
   *  la conjugación de un verbo, la concordancia de un adjetivo, el artículo y
   *  el plural de un sustantivo, el paradigma de un pronombre. Las palabras que
   *  no se declinan (adverbios, preposiciones) traen tres usos reales. */
  f?: {
    label?: string;
    /** El MODO, cuando la palabra no es un indicativo: "Subjunctive",
     *  "Formal command", "Konjunktiv II"... Se pinta como distintivo junto al
     *  tipo y es lo unico de la tarjeta que se lee de un vistazo. Lo escribe
     *  `scripts/buildGlossMoods.ts`. */
    mood?: string;
    /** Celdas SIEMPRE a la vista, delante de `rows`. En los modos con
     *  paradigma detras son dos: la forma que el lector ya conoce y la que
     *  tiene delante, cada una con el nombre de SU tiempo
     *  (`[["present","se va"],["subjunctive","se vaya"]]`). Sin esto, quien
     *  viene del ingles no tiene como saber que `se vaya` no es `se va`. */
    head?: string[][];
    /** "line": las formas que FALTAN, siempre a la vista y sin desplegable (el
     *  plural de un sustantivo, las otras concordancias de un adjetivo). Nunca
     *  repite la que ya sale en el trozo de arriba.
     *  "expand": no enseña nada de entrada y el enlace nombra lo que hay detrás
     *  ("See conjugation"), que se despliega dentro de la tarjeta. */
    kind?: "line" | "expand";
    /** Texto del enlace en las de tipo "expand". */
    link?: string;
    /** Forma de diccionario (infinitivo del verbo, masculino singular del
     *  adjetivo). Se enseña junto a la palabra cuando NO coincide con la que
     *  sale en la historia; la cabecera siempre manda la del texto. */
    lemma?: string;
    rows: string[][];
    /** Índice de la forma que sale en la historia, para encenderla al
     *  desplegar. -1 cuando esa forma no está en la lista. */
    here: number;
  };
};

export type TapGlossMap = Record<string, TapGloss>;

/** Cache por proceso. Las glosas cambian cuando alguien corre un script de
 *  autoria, no en mitad de una peticion, asi que no hace falta invalidarla
 *  fina: el TTL corto la refresca sola sin castigar a la base en cada lectura. */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: TapGlossMap | null }>();

/**
 * Las glosas de una historia: el mapa global de su bundle con la capa de esa
 * historia encima, palabra a palabra. Devuelve null si ninguna fila la cubre,
 * que es lo que el lector usa para degradar a solo pills curadas.
 */
export async function getTapGlossesForSlug(slug: string): Promise<TapGlossMap | null> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  // Una sola consulta: la fila de ESTA historia y la global de su bundle. El
  // bundle sale del `slugs` de la fila global, que es donde se declara que
  // historias cubre.
  const filas = await prisma.tapGlossSet.findMany({
    where: { OR: [{ slug }, { slug: "", slugs: { has: slug } }] },
    select: { slug: true, glosses: true },
  });
  const global = filas.find((f) => f.slug === "");
  const propia = filas.find((f) => f.slug === slug);
  let value: TapGlossMap | null = null;
  if (global || propia) {
    value = { ...((global?.glosses as TapGlossMap) ?? {}), ...((propia?.glosses as TapGlossMap) ?? {}) };
  }
  cache.set(slug, { at: Date.now(), value });
  return value;
}
