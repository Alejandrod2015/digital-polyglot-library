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
 * La palabra: vale el lema o la forma de la historia. Se prueban las dos
 * porque el usuario puede decir cualquiera y las dos son la palabra; pedirle
 * el lema dentro de una frase seria pedirle que hable mal.
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

/**
 * El CANDADO del turno hablado: un turno se resuelve UNA vez.
 *
 * Al turno hablado le apuntan tres vias (el reloj de contestar, el resultado
 * del reconocedor y su parada automatica) y todas acaban en el mismo sitio.
 * Basta con que una llegue tarde para que un acierto ya cantado se vuelva a
 * calificar como fallo, con su sonido.
 *
 * Y llegan tarde de verdad: al resolver el ULTIMO ejercicio de la tanda,
 * `advancePractice` cierra la sesion poniendo `practiceRevealed` en false SIN
 * avanzar el indice, asi que el ejercicio en curso sigue siendo el mismo y
 * cualquier guard que solo mirase "ya esta revelado" se reabria encima de la
 * pantalla de resultados.
 *
 * El candado no mira el estado, que va y viene: mira QUE ejercicio se resolvio.
 */
export function isSpeakingTurnAlreadyResolved(
  resolvedExerciseId: string | null | undefined,
  exerciseId: string
): boolean {
  return Boolean(resolvedExerciseId) && resolvedExerciseId === exerciseId;
}

/**
 * Cuanta frase hay que decir para que cuente.
 *
 * Decision del usuario el 2026-09-14: "acierto si dijo la palabra y al menos
 * la mitad de las demas". La mitad, y no la frase entera, porque el
 * reconocedor del sistema se come palabras cortas y atonas con total
 * normalidad; exigir el 100% seria calificar al reconocedor, no al usuario.
 */
export const SPEAKING_MIN_COVERAGE = 0.5;

export type SpeakingSentenceVerdict = {
  /** Acierto del ejercicio: dijo la palabra Y bastante frase. */
  correct: boolean;
  /** Dijo la palabra, con independencia de cuanta frase dijera. */
  wordSaid: boolean;
  /** Fraccion del RESTO de la frase que aparece en lo reconocido, de 0 a 1. */
  coverage: number;
  formFound: string | null;
};

/**
 * G4: la calificacion del turno hablado, y toda ella.
 *
 * El ejercicio pide la FRASE ENTERA con el hueco relleno, no la palabra
 * suelta: decir una palabra aislada no se parece a hablar, que es justo lo que
 * los usuarios piden aprender. Asi que se miden dos cosas y se exigen las dos.
 *
 * La cobertura no mira el ORDEN. El reconocedor reordena, junta y parte
 * palabras segun le va, y penalizar eso seria medir el dictado en vez de la
 * frase. Tampoco filtra los tokens de una o dos letras: los articulos y las
 * preposiciones cortas el usuario los dice igual, y quitarlos del denominador
 * haria la mitad mas facil justo en las frases mas cortas.
 */
export function gradeSentence(
  transcript: string,
  word: string,
  surface: string | null | undefined,
  sentence: string
): SpeakingSentenceVerdict {
  const palabra = gradeDeterministic(transcript, word, surface);

  // Los tokens de la palabra objetivo salen del denominador: ya los mide
  // `wordSaid`, y contarlos dos veces regalaria cobertura al que solo dijo la
  // palabra.
  const objetivo = new Set([
    ...normalizeForSpeaking(word).split(" "),
    ...normalizeForSpeaking(surface ?? "").split(" "),
  ].filter(Boolean));

  const resto = normalizeForSpeaking(sentence)
    .split(" ")
    .filter((token) => token && !objetivo.has(token));

  // Frase que es solo la palabra: no hay resto que exigir.
  if (resto.length === 0) {
    return {
      correct: palabra.correct,
      wordSaid: palabra.correct,
      coverage: 1,
      formFound: palabra.formFound,
    };
  }

  const dichos = resto.filter((token) => containsWholeWord(transcript, token)).length;
  const coverage = dichos / resto.length;

  return {
    correct: palabra.correct && coverage >= SPEAKING_MIN_COVERAGE,
    wordSaid: palabra.correct,
    coverage,
    formFound: palabra.formFound,
  };
}
