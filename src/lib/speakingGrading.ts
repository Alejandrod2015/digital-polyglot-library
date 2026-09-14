/**
 * Los dos gates verificables del ejercicio de speaking (piloto 2026-09-14).
 *
 * Viven fuera de la ruta a proposito: son funciones puras y son lo unico del
 * ejercicio que un test puede afirmar sin hablarle a OpenAI ni a la base. El
 * spec los llama G1 y G5.
 *
 * G1: la pregunta NO puede contener la palabra que pide. Si la lleva, el
 *     ejercicio deja de medir recuperacion y pasa a medir lectura.
 * G5: la calificacion es DETERMINISTA primero. El LLM solo entra cuando la
 *     comparacion literal falla, y entonces esta obligado a devolver la forma
 *     exacta que dice haber encontrado; el servidor comprueba que esa forma
 *     esta de verdad en la transcripcion. El LLM nunca aprueba solo.
 */

/**
 * Guiones largos (em y en) por punto de codigo. Ni el caracter literal ni su
 * escape pueden aparecer en `src/`, asi que se construyen con su codigo.
 */
const GUIONES_LARGOS = new RegExp(`[${String.fromCharCode(8212, 8211)}]`, "g");

/**
 * Minusculas, sin acentos y sin puntuacion. Whisper escribe con tildes y con
 * comas; el usuario dice la palabra igual la escriba como la escriba, asi que
 * comparar sin normalizar dejaria "trabajo," fuera de "trabajo".
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

/**
 * G1. La pregunta filtra la palabra cuando contiene el lema o la forma de la
 * historia. La comparacion es sin acentos a proposito: "trabajó" en la
 * pregunta regala "trabajo" igual de claro que escribirla sin tilde.
 */
export function questionLeaksWord(
  question: string,
  word: string,
  surface?: string | null
): boolean {
  const candidates = [word, surface ?? ""].filter((value) => normalizeForSpeaking(value));
  return candidates.some((candidate) => containsWholeWord(question, candidate));
}

export type SpeakingVerdict = {
  correct: boolean;
  /** Forma exacta hallada en la transcripcion; null cuando no hay ninguna. */
  formFound: string | null;
  /** Que decidio el veredicto, para poder leerlo en un log sin adivinar. */
  via: "deterministic" | "llm" | "none";
};

/**
 * G5, primera pasada: comparacion literal. Si el usuario dijo el lema o la
 * forma de la historia, es acierto y no hace falta gastar una llamada.
 */
export function gradeDeterministic(
  transcript: string,
  word: string,
  surface?: string | null
): SpeakingVerdict {
  for (const candidate of [word, surface ?? ""]) {
    if (!normalizeForSpeaking(candidate)) continue;
    if (containsWholeWord(transcript, candidate)) {
      return { correct: true, formFound: candidate.trim(), via: "deterministic" };
    }
  }
  return { correct: false, formFound: null, via: "none" };
}

/**
 * G5, segunda pasada: el veredicto del LLM solo vale si la forma que dice
 * haber encontrado esta de verdad en la transcripcion.
 *
 * Es el candado entero del gate: sin el, un modelo complaciente aprueba una
 * respuesta que nunca uso la palabra, y nadie se entera porque la pantalla
 * solo ensena el acierto. Con el, aprobar exige senalar donde.
 */
export function verifyLlmForm(transcript: string, formFound?: string | null): SpeakingVerdict {
  const form = (formFound ?? "").trim();
  if (!form) return { correct: false, formFound: null, via: "none" };
  if (!containsWholeWord(transcript, form)) {
    return { correct: false, formFound: null, via: "none" };
  }
  return { correct: true, formFound: form, via: "llm" };
}

/** G7: nada de lo generado lleva guion largo. */
export function stripLongDashes(value: string): string {
  return (value ?? "").replace(GUIONES_LARGOS, "; ").replace(/\s+/g, " ").trim();
}

/**
 * G6: una linea, en ingles, por debajo de 20 palabras. El tope se recorta
 * aqui en vez de confiar en que el modelo lo respete.
 */
export function clampFeedback(value: string, maxWords = 19): string {
  const cleaned = stripLongDashes((value ?? "").replace(/\s+/g, " ").trim());
  if (!cleaned) return "";
  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return `${words.slice(0, maxWords).join(" ")}.`;
}
