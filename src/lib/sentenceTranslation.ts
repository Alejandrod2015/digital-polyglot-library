/**
 * La traduccion al ingles de la frase de un ejercicio de contexto.
 *
 * Los sets curados la guardan en `StoryPracticeExercise.payload.translation`
 * con `_____` en el sitio de la palabra, porque en `fill_blank` la respuesta
 * todavia no se conoce cuando se lee la frase. Al RESOLVER si se conoce, y ahi
 * el hueco puede rellenarse con la glosa corta de la respuesta.
 *
 * Vive aparte y sin dependencias para que la use tanto la ruta que sirve los
 * favoritos al movil como un test, sin arrastrar prisma ni el catalogo.
 */

/** El hueco tal como lo deja el generador: tres guiones bajos o mas. */
const HUECO = /_{3,}/;

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function listaDeTextos(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : "")) : [];
}

/**
 * Devuelve la traduccion de la frase con el hueco relleno cuando se puede
 * saber que glosa corresponde a la respuesta, y con el hueco tal cual cuando
 * no. Devuelve null si no hay traduccion que ensenar.
 *
 * El criterio para encontrar la glosa es el MISMO que usa la web al revelar
 * (`options.indexOf(answer)` sobre `optionTranslations`), y a proposito: si
 * los dos divergen, la misma frase se traduce distinto en el telefono y en el
 * navegador.
 */
export function fillSentenceTranslationBlank(
  translation: unknown,
  answer: unknown,
  options: unknown,
  optionTranslations: unknown
): string | null {
  const frase = texto(translation);
  if (!frase) return null;
  if (!HUECO.test(frase)) return frase;

  const respuesta = texto(answer);
  if (!respuesta) return frase;

  const opciones = listaDeTextos(options);
  const glosas = listaDeTextos(optionTranslations);
  const indice = opciones.findIndex((opcion) => opcion.trim() === respuesta);
  if (indice < 0) return frase;

  const glosa = texto(glosas[indice]);
  if (!glosa) return frase;

  return frase.replace(HUECO, glosa);
}

/**
 * De donde sale la traduccion de la frase de una palabra, y en que orden.
 *
 * 1. La COLUMNA `StoryPracticeSet.sentenceTranslations`, escrita a mano. Manda
 *    porque cubre todas las palabras de la historia y porque alguien la
 *    reviso; el hueco ya viene relleno, sin `_____` que resolver.
 * 2. El `fill_blank` curado, como reserva. Solo existe para 4 a 6 palabras por
 *    historia, asi que cubre poco, pero lo que cubre es bueno.
 * 3. Nada. Y entonces en pantalla no se pinta nada, que es preferible a
 *    inventar una traduccion.
 */
export function resolveSentenceTranslation(params: {
  /** Valor de la columna para ESA palabra, ya buscado por clave normalizada. */
  fromColumn: unknown;
  /** Lo que devolvio `fillSentenceTranslationBlank` para su `fill_blank`. */
  fromFillBlank: string | null;
}): string | null {
  const columna = texto(params.fromColumn);
  if (columna) return columna;
  return params.fromFillBlank || null;
}

/**
 * Todas las traducciones de frase de UNA historia, por palabra normalizada.
 *
 * Se construye por HISTORIA y no por ejercicio, y ese es justo el arreglo: la
 * version anterior leia la columna dentro del bucle que empareja palabras con
 * EJERCICIOS curados, asi que una palabra sin ejercicio (o con ejercicio pero
 * sin clip) no llegaba nunca a la columna. En `la-macchinetta-gialla`, con 25
 * traducciones escritas, solo `stazione` salia con traduccion; `biglietto` y
 * `mettere` no, porque no tenian ejercicio.
 *
 * La columna es la fuente principal y cubre toda la historia; el `fill_blank`
 * se queda de reserva para las palabras que la columna no traiga.
 */
export function buildSentenceTranslationMap(params: {
  /** `StoryPracticeSet.sentenceTranslations` tal cual sale de la base. */
  column: unknown;
  /** Los ejercicios del set; solo se miran los `fill_blank`. */
  exercises: readonly { type?: unknown; word?: unknown; payload?: unknown }[];
}): Map<string, string> {
  const out = new Map<string, string>();

  // 1. La reserva primero, para que la columna la pise si trae esa palabra.
  for (const ex of params.exercises) {
    if (ex?.type !== "fill_blank") continue;
    const word = typeof ex.word === "string" ? ex.word : "";
    if (!word) continue;
    const payload = (ex.payload ?? null) as Record<string, unknown> | null;
    const traduccion = fillSentenceTranslationBlank(
      payload?.translation,
      payload?.answer,
      payload?.options,
      payload?.optionTranslations
    );
    if (!traduccion) continue;
    const clave = sentenceTranslationKey(word);
    if (!out.has(clave)) out.set(clave, traduccion);
  }

  // 2. La columna manda, y entra para TODA palabra que traiga, tenga o no
  //    ejercicio en el set.
  const escritas = (params.column ?? null) as Record<string, unknown> | null;
  if (escritas && typeof escritas === "object") {
    for (const [palabra, valor] of Object.entries(escritas)) {
      if (typeof valor !== "string" || !valor.trim()) continue;
      out.set(sentenceTranslationKey(palabra), valor.trim());
    }
  }

  return out;
}

/**
 * La clave con la que se guarda y se busca en la columna. Es el mismo `norm`
 * que la ruta de favoritos usa para casar palabra con ejercicio; vive aqui
 * para que el script que escribe y la ruta que lee no puedan discrepar.
 */
export function sentenceTranslationKey(word: string): string {
  return (word ?? "").trim().toLowerCase();
}

function sinAcentosMinusculas(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function llevaPalabraCompleta(texto: string, palabra: string): boolean {
  const tokens = sinAcentosMinusculas(texto).split(" ").filter(Boolean);
  const buscados = sinAcentosMinusculas(palabra).split(" ").filter(Boolean);
  if (buscados.length === 0 || tokens.length < buscados.length) return false;
  for (let i = 0; i <= tokens.length - buscados.length; i += 1) {
    if (buscados.every((b, j) => tokens[i + j] === b)) return true;
  }
  return false;
}

/**
 * Comprueba si una traduccion dejo la palabra objetivo SIN traducir.
 *
 * Es el fallo mas probable al traducir una frase de practica: se traduce todo
 * menos justo la palabra que el ejercicio pide. Pero la regla tal cual
 * rechazaba tambien los prestamos que el ingles usa igual, y para pasar el gate
 * habia que escribir rodeos como "long thin pasta with bolognese sauce", que es
 * PEOR traduccion que la palabra correcta.
 *
 * Hay DOS salidas, y el orden importa:
 *
 * 1. La DEFINICION en ingles de la propia palabra. Es la preferible porque el
 *    dato ya existe y ya lo reviso alguien: si la definicion usa esa misma
 *    forma ("Spaghetti; long thin pasta..."), en ingles se dice asi.
 * 2. La LISTA de terminos que se dejan tal cual
 *    (`docs/sentence-translations/keep-as-is.json`), para cuando la definicion
 *    dice otra cosa: `barista` esta definido como "Barman; ...", y `ragù` como
 *    "Meat sauce...", pero un texto en ingles los escribe igual.
 *
 * La lista se pasa como DATO, no se lee desde aqui: esta funcion se mide en un
 * test y no puede depender del disco.
 */
export function translationLeavesWordUntranslated(
  translation: string,
  word: string,
  definition?: string | null,
  keepAsIs?: readonly string[] | null
): boolean {
  if (!llevaPalabraCompleta(translation, word)) return false;
  // 1. El ingles lo dice igual, y su propia definicion lo demuestra.
  if (llevaPalabraCompleta(definition ?? "", word)) return false;
  // 2. O esta en la lista de terminos culturales que se dejan tal cual.
  const normalizada = sinAcentosMinusculas(word);
  if (normalizada && (keepAsIs ?? []).some((t) => sinAcentosMinusculas(t) === normalizada)) {
    return false;
  }
  return true;
}
