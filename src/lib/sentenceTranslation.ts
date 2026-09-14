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
 * Todas las traducciones de frase de UNA historia, por ORACION normalizada.
 *
 * La clave es la oracion y no la palabra. Con la palabra por clave, el turno
 * hablado pintaba la traduccion de la frase del VOCAB debajo de una frase
 * distinta: la suya puede venir del `exampleSentence` del favorito, del item
 * construido desde el texto de la historia o del `fill_blank` curado. Para
 * `stazione` el vocab decia "Rosa compra il biglietto alla biglietteria
 * automatica della stazione..." y en pantalla se leia "Il treno per Firenze
 * parte da questa stazione.".
 *
 * Se construye por HISTORIA y no por ejercicio: una palabra sin ejercicio (o
 * con ejercicio pero sin clip) tambien tiene que llegar a la columna.
 *
 * Dos fuentes, y la columna gana:
 *
 * 1. El `fill_blank` curado, de reserva. Su frase se guarda CON el hueco, asi
 *    que para indexarla por oracion hay que devolverle la respuesta al sitio
 *    del que salio; la normalizacion se traga lo demas (mayuscula inicial,
 *    puntuacion, comillas).
 * 2. La COLUMNA `StoryPracticeSet.sentenceTranslations`, escrita a mano y ya
 *    indexada por oracion normalizada.
 *
 * Lo que no este en ninguna de las dos no se pinta. Ensenar la traduccion de
 * otra frase es peor que no ensenar ninguna.
 */
export function buildSentenceTranslationMap(params: {
  /** `StoryPracticeSet.sentenceTranslations` tal cual sale de la base. */
  column: unknown;
  /** Los ejercicios del set; solo se miran los `fill_blank`. */
  exercises: readonly { type?: unknown; word?: unknown; payload?: unknown }[];
}): Map<string, string> {
  const out = new Map<string, string>();

  // 1. La reserva primero, para que la columna la pise si trae esa oracion.
  for (const ex of params.exercises) {
    if (ex?.type !== "fill_blank") continue;
    const payload = (ex.payload ?? null) as Record<string, unknown> | null;
    const traduccion = fillSentenceTranslationBlank(
      payload?.translation,
      payload?.answer,
      payload?.options,
      payload?.optionTranslations
    );
    if (!traduccion) continue;
    const entera = sentenceFromBlanked(payload?.sentence, payload?.answer);
    if (!entera) continue;
    const clave = normalizeSentenceKey(entera);
    if (clave && !out.has(clave)) out.set(clave, traduccion);
  }

  // 2. La columna manda, y entra para TODA oracion que traiga, tenga o no
  //    ejercicio en el set.
  const escritas = (params.column ?? null) as Record<string, unknown> | null;
  if (escritas && typeof escritas === "object") {
    for (const [oracion, valor] of Object.entries(escritas)) {
      if (typeof valor !== "string" || !valor.trim()) continue;
      const clave = normalizeSentenceKey(oracion);
      if (clave) out.set(clave, valor.trim());
    }
  }

  return out;
}

/**
 * La oracion ENTERA de un `fill_blank`, que la guarda con el hueco puesto.
 * Devuelve null si no hay hueco que rellenar o no se sabe con que.
 */
export function sentenceFromBlanked(blanked: unknown, answer: unknown): string | null {
  const frase = texto(blanked);
  const respuesta = texto(answer);
  if (!frase || !respuesta) return null;
  if (!HUECO.test(frase)) return frase;
  return frase.replace(HUECO, respuesta);
}

/**
 * Busca en el mapa la traduccion de ESTA frase, y solo de esta. Sin
 * coincidencia exacta (ya normalizada) devuelve null y no se pinta nada.
 */
export function lookupSentenceTranslation(
  map: unknown,
  sentence: string
): string | null {
  const clave = normalizeSentenceKey(sentence);
  if (!clave) return null;
  if (map instanceof Map) {
    const hallado = map.get(clave);
    return typeof hallado === "string" && hallado.trim() ? hallado.trim() : null;
  }
  if (map && typeof map === "object") {
    for (const [oracion, valor] of Object.entries(map as Record<string, unknown>)) {
      if (typeof valor !== "string" || !valor.trim()) continue;
      if (normalizeSentenceKey(oracion) === clave) return valor.trim();
    }
  }
  return null;
}

/**
 * La clave con la que se guarda y se busca en la columna: la ORACION.
 *
 * Antes la clave era la PALABRA, y de ahi salia el bug que el usuario vio en
 * el telefono: la etiqueta MEANING ensenaba una traduccion que no era la de la
 * frase en pantalla, "a veces mas de la oracion, a veces menos". La columna se
 * escribio traduciendo la frase del VOCAB, pero el turno hablado pinta la
 * frase que le llega por otro camino (el `exampleSentence` del favorito, el
 * item construido desde el texto de la historia, o el `fill_blank` curado), y
 * para `stazione` esas dos frases eran distintas. Una palabra no identifica
 * una frase; la frase, si.
 *
 * La normalizacion tiene que tragarse las diferencias que NO cambian la frase:
 * mayusculas, acentos, el tipo de comillas (curvas contra rectas, que es la
 * diferencia real entre el texto de la historia y lo que copia un dump) y la
 * puntuacion. Lo que queda son letras, numeros y un espacio entre ellos.
 */
export function normalizeSentenceKey(sentence: string): string {
  return sinAcentosMinusculas(sentence ?? "");
}

/**
 * La clave con la que se casa una PALABRA (vocab, ejercicio, favorito). Ya no
 * indexa la columna de traducciones; sigue viva porque la ruta de favoritos y
 * el validador la usan para emparejar palabra con ejercicio.
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
