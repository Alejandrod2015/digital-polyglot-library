/**
 * La calificacion del ejercicio hablado, entera.
 *
 * Son tres funciones puras y no hay una cuarta: lo que el reconocedor del
 * sistema devuelve se compara con la palabra, y lo que no casa es fallo. No
 * hay segunda pasada ni modelo que opine. La v1 tenia una llamada a un LLM
 * aqui para rescatar formas flexionadas; el usuario la rechazo entera ("no
 * usamos API de OpenAI"), y con ella se va tambien la unica parte del
 * ejercicio que no se podia afirmar sin salir a la red.
 *
 * Vive fuera del movil para que un test la pueda medir sin arrancar Expo.
 */

/**
 * Minusculas, sin acentos y sin puntuacion. El reconocedor escribe con tildes
 * y mete comas y puntos; el usuario dice la palabra igual, asi que comparar en
 * crudo dejaria "trabajo," fuera de "trabajo".
 */
export function normalizeForSpeaking(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  const normalized = normalizeForSpeaking(value);
  return normalized ? normalized.split(" ") : [];
}

/**
 * PALABRA COMPLETA, y con soporte para expresiones de varias palabras.
 *
 * Un `includes` suelto daria por buena "por" dentro de "porque" y "ir" dentro
 * de "vivir": el ejercicio aprobaria a quien no dijo nada parecido. Se compara
 * por secuencia de tokens, que ademas cubre el vocab multi-palabra ("darse
 * cuenta") sin caso aparte.
 */
export function containsWholeWord(haystack: string, needle: string): boolean {
  const needleTokens = tokens(needle);
  if (needleTokens.length === 0) return false;
  const hayTokens = tokens(haystack);
  if (hayTokens.length < needleTokens.length) return false;

  for (let i = 0; i <= hayTokens.length - needleTokens.length; i += 1) {
    let match = true;
    for (let j = 0; j < needleTokens.length; j += 1) {
      if (hayTokens[i + j] !== needleTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export type SpeakingVerdict = {
  correct: boolean;
  /** Forma exacta hallada en lo reconocido; null cuando no hay ninguna. */
  formFound: string | null;
};

/**
 * G4: la calificacion, y toda ella.
 *
 * Vale el lema o la forma de la historia. Se prueban las dos porque el usuario
 * puede decir cualquiera de ellas y las dos son la palabra: pedirle el lema
 * dentro de una frase seria pedirle que hable mal.
 */
export function gradeDeterministic(
  recognized: string,
  word: string,
  surface?: string | null
): SpeakingVerdict {
  for (const candidate of [word, surface ?? ""]) {
    if (!normalizeForSpeaking(candidate)) continue;
    if (containsWholeWord(recognized, candidate)) {
      return { correct: true, formFound: candidate.trim() };
    }
  }
  return { correct: false, formFound: null };
}
