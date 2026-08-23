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
/**
 * Orden por demanda real, no por lo que suena mejor: sobre las 44 primeras
 * solicitudes salieron Travel 15, Family connection 9, Just for fun 9, Move
 * abroad 4 y Work 2. La primera opción visible es la que más gente marca.
 *
 * "Keep up my level" se añadió el 2026-08-23: seis textos libres hablaban de
 * conservar o refrescar lo que ya tienen ("maintain and practice my level of
 * Spanish"), y una de las tres respuestas escritas a mano decía literalmente
 * "To maintain my degree in Spanish". Hasta entonces esa gente caía en "Just
 * for fun", la opción con menos puntos del score, siendo el perfil que más
 * aguanta: ya invirtió años.
 */
export const BETA_MOTIVATIONS = [
  "Travel",
  "Family connection",
  "Just for fun",
  "Keep up my level",
  "Move abroad",
  "Work",
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

/**
 * Suelo de lo que cuenta como una frase escrita, compartido por el formulario
 * (que no deja enviar menos) y por el portón de temas (que no acepta una cita
 * más corta). Tres palabras es lo que separa una frase de una etiqueta: "move
 * abroad" y "my job" no dicen de qué habla nadie.
 */
export const MIN_EVIDENCE_WORDS = 3;
export const MIN_EVIDENCE_CHARS = 15;

export function countWords(text: string | null | undefined): number {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/** true si el texto es demasiado corto para respaldar un tema. */
export function tooShortForEvidence(text: string | null | undefined): boolean {
  const v = String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return v.length < MIN_EVIDENCE_CHARS || countWords(v) < MIN_EVIDENCE_WORDS;
}

/**
 * El tipo de journey que pide cada motivación.
 *
 * WHY (2026-08-23): la pregunta "why are you learning" solo movía puntos de un
 * score que nadie aplica (el auto-invite lleva apagado desde el principio) y
 * pintaba una barra. Los tipos de journey que existen son casi la misma
 * pregunta, así que la respuesta pasa a significar en qué journey entra ese
 * tester y cuál toca escribir después.
 *
 * Los slugs son los de `JourneyType`. `relationships` es el tipo cuyos
 * journeys se llaman "Friends" en la app; aquí se usa la etiqueta de la tabla
 * para que un informe del Studio y la tabla de tipos digan lo mismo.
 *
 * `null` es una respuesta legítima: "Other" es texto libre y no se adivina.
 */
const MOTIVATION_JOURNEY_TYPE: Record<string, { slug: string; label: string }> = {
  travel: { slug: "traveler", label: "Traveler" },
  "move abroad": { slug: "expat", label: "Expat" },
  "family connection": { slug: "relationships", label: "Relationships" },
  "just for fun": { slug: "relationships", label: "Relationships" },
  // Quien conserva un nivel alto quiere leer conversación entre gente, no un
  // trámite ni un aeropuerto. Lo que le falta no es tipo sino NIVEL: pide el
  // C1 de Relationships, no el A0.
  "keep up my level": { slug: "relationships", label: "Relationships" },
  work: { slug: "business", label: "Business" },
};

export function motivationJourneyType(
  motivation: string | null | undefined,
): { slug: string; label: string } | null {
  return MOTIVATION_JOURNEY_TYPE[normalizeMotivation(motivation)] ?? null;
}
