/**
 * Las opciones del desplegable "why are you learning" del formulario de beta,
 * en UN solo sitio.
 *
 * WHY (2026-08-19): `BetaSignup.motivation` NO es texto libre. Es este
 * desplegable, salvo cuando la persona elige "Other" y escribe la suya (el
 * formulario guarda entonces lo escrito, nunca la palabra "Other"). El portón
 * de temas (`topicEvidence.ts`) daba por evidencia cualquier valor del campo,
 * así que la cadena "move abroad" respaldaba SIETE temas de un Expat francés a
 * la vez: un clic de dos palabras valía por siete decisiones de contenido.
 *
 * Vive aquí, y no dentro del componente de cliente, para que el formulario y
 * el portón no se desincronicen cuando alguien añada o cambie una opción.
 */
export const BETA_MOTIVATIONS = [
  "Travel",
  "Family connection",
  "Work",
  "Move abroad",
  "Just for fun",
  "Other",
] as const;

export type BetaMotivation = (typeof BETA_MOTIVATIONS)[number];

/** Minúsculas, espacios colapsados y sin puntuación de cierre. */
export function normalizeMotivation(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!,;:]+$/g, "")
    .trim();
}

const CANNED = new Set(BETA_MOTIVATIONS.map((m) => normalizeMotivation(m)));

/**
 * true si el valor es un clic del desplegable y no una frase que alguien
 * escribió. Un clic dice a qué categoría pertenece la persona; no dice de qué
 * habla, así que no respalda ningún tema.
 */
export function isCannedMotivation(value: string | null | undefined): boolean {
  const v = normalizeMotivation(value);
  return v.length > 0 && CANNED.has(v);
}
