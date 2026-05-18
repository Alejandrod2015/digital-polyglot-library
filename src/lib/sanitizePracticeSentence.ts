// Normaliza el texto de una frase de práctica antes de guardarla o
// mandarla al motor TTS. Resuelve un patrón recurrente del generador
// de stories: al haber extraído al ejercicio el cuerpo de un diálogo,
// la comilla recta de cierre se queda huérfana (ej. `Grazie per
// l'aiuto!'`) y los motores TTS la vocalizan como un click glótico al
// final del clip.
//
// El sanitizer es **conservador**: solo quita comillas RECTAS (`'` y
// `"`) cuando son claramente residuales (tras `.!?` o sin pareja
// previa). Las comillas curvas (« » " " ' ') se preservan porque sí
// son cierres legítimos de diálogo.
//
// El sanitizer es **idempotente**: aplicado dos veces produce el
// mismo resultado, por lo que es seguro correrlo en bucle de
// backfill o desde múltiples write paths.

const TRAILING_QUOTES_AFTER_PUNCT = /([.!?])['"]+\s*$/;
const TRAILING_LONE_QUOTE = /['"]$/;

export function sanitizePracticeSentence(sentence: string): string {
  let s = sentence;
  // 1) Comillas rectas que siguen inmediatamente a la puntuación
  //    final (`.!?`). Casi siempre son orphans del diálogo perdido.
  s = s.replace(TRAILING_QUOTES_AFTER_PUNCT, "$1");
  // 2) Comilla recta solitaria al final cuya pareja no aparece en el
  //    resto de la frase (paridad impar). Si hay pareja la dejamos
  //    tranquila — podría ser una contracción como `l'`.
  if (TRAILING_LONE_QUOTE.test(s)) {
    const last = s.at(-1)!;
    const earlier = s.slice(0, -1);
    const opens = (earlier.match(new RegExp(`\\${last}`, "g")) ?? []).length;
    if (opens % 2 === 0) s = earlier;
  }
  return s.trim();
}

// Devuelve la frase con `_____` reemplazado por la palabra real y
// limpia. Útil justo antes de mandar al endpoint TTS.
export function preparePracticeSentenceForTts(sentence: string, word: string): string {
  return sanitizePracticeSentence(sentence).replace(/_+/g, word);
}

// Indica si la frase tiene el patrón sucio que el sanitizer eliminaría.
// Útil para mostrar un warning inline al editor antes de guardar.
export function isDirtyPracticeSentence(sentence: string): boolean {
  if (TRAILING_QUOTES_AFTER_PUNCT.test(sentence)) return true;
  if (TRAILING_LONE_QUOTE.test(sentence)) {
    const last = sentence.at(-1)!;
    const earlier = sentence.slice(0, -1);
    const opens = (earlier.match(new RegExp(`\\${last}`, "g")) ?? []).length;
    if (opens % 2 === 0) return true;
  }
  return false;
}
