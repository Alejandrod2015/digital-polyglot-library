/**
 * Patrones de pregunta parcial (wh-question) por idioma, compartidos por los
 * generadores de audio de práctica (`_genPracticeClips.ts`,
 * `_genFillBlankClips.ts`).
 *
 * Una wh-question (quién/qué/cómo... o qui/que/où...) termina cayendo por
 * naturaleza: la partícula interrogativa ya marca la pregunta, no hace falta
 * el rasgo prosódico de la subida final. Solo las preguntas de sí/no exigen
 * esa subida, que es lo que mide el gate F0 (`_f0gate.py`, modo "question").
 * Antes de esto cada script duplicaba el mismo regex por idioma; vive aquí
 * para que no vuelvan a desincronizarse.
 *
 * Claves: el nombre completo del idioma tal como lo guarda `Journey.language`
 * (spanish, german, portuguese, italian, french), en minúsculas.
 *
 * Francés (2026-09-13): añadido tras el FR A1 Friends, donde
 * "Où est la bibliothèque près d'ici?" agotó los 6 intentos del gate F0
 * porque `_genFillBlankClips.ts` no excluía las wh-questions del modo
 * "question" (a diferencia de `_genPracticeClips.ts`, que sí las excluye
 * para es/de/pt/it desde antes).
 */
export const WH_QUESTION_PATTERNS: Record<string, RegExp> = {
  spanish: /(qué|quién|quiénes|cómo|cuándo|dónde|adónde|cuál|cuáles|cuánto|cuánta|cuántos|cuántas)/i,
  german: /(\bwer\b|\bwen\b|\bwem\b|\bwessen\b|\bwas\b|\bwie\b|\bwieso\b|\bweshalb\b|\bwarum\b|\bwann\b|\bwo\b|\bwohin\b|\bwoher\b|\bwelch)/i,
  portuguese: /(\bo que\b|\bque\b|\bquem\b|\bcomo\b|\bquando\b|\bonde\b|\baonde\b|\bqual\b|\bquais\b|\bquanto\b|\bquanta\b|\bquantos\b|\bquantas\b|\bpor que\b)/i,
  italian: /(\bche cosa\b|\bche\b|\bchi\b|\bcome\b|\bquando\b|\bdove\b|\bquale\b|\bquali\b|\bquanto\b|\bquanta\b|\bquanti\b|\bquante\b|\bperché\b)/i,
  french: /(\boù\b|\bquand\b|\bcomment\b|\bpourquoi\b|\bqui\b|\bqu['’]|\bque\b|\bquoi\b|\bquel(?:le)?s?\b|\bcombien\b|\blequel\b|\blaquelle\b)/i,
};

/** true si `sentence` lleva una partícula interrogativa del idioma dado. */
export function isWhQuestion(language: string | null | undefined, sentence: string): boolean {
  const re = WH_QUESTION_PATTERNS[(language ?? "").trim().toLowerCase()];
  return !!re && re.test(sentence);
}
