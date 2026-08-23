/**
 * Los temas que el formulario de beta ofrece marcar, en UN solo sitio.
 *
 * WHY (2026-08-23): preguntar "de qué quieres leer" en texto libre ya se probó
 * y devolvió frases escritas para caer bien ("day to day conversations"). Una
 * lista marcable devuelve algo que SÍ se puede contar: cuánta gente de cada
 * idioma quiere cada dominio, que es exactamente la decisión que hay que tomar
 * al elegir los siete temas de un journey.
 *
 * Los slugs son los de `Topic` con `isUniversal: true`, para que lo que marca
 * un solicitante se cruce sin traducción con los temas que ya existen.
 *
 * Son SIETE, no los dieciséis universales, y en este orden. Los cinco primeros
 * salen de contar los dominios en lo que escribieron los 42 solicitantes con
 * texto: viajes 16, casa y familia 10, trabajo 8, conocer gente 8, ciudad 6.
 * "Technology & Media" (8) y "Arts & Creativity" (6) puntuaban por las
 * palabras "app" y "book", que es de lo que habla quien solicita entrar a la
 * beta de una app hecha por una editorial, no de lo que quiere leer: fuera.
 * Los dos últimos no salen de ahí sino del catálogo, porque la pregunta que
 * respondieron era por qué solicitan, no de qué quieren leer: comida y
 * costumbres son, con diferencia, los dominios que más temas tienen ya
 * escritos entre los 169 de `Topic`.
 */
export const BETA_TOPIC_INTERESTS = [
  { slug: "travel-discovery", label: "Travel & Discovery" },
  { slug: "home-family", label: "Home & Family" },
  { slug: "work-study", label: "Work & Study" },
  { slug: "meeting-new-people", label: "Meeting New People" },
  { slug: "city-getting-around", label: "City & Getting Around" },
  { slug: "food-everyday-life", label: "Food & Drink" },
  { slug: "traditions-daily-culture", label: "Traditions & Daily Culture" },
] as const;

export type BetaTopicInterest = (typeof BETA_TOPIC_INTERESTS)[number]["slug"];

const SLUGS = new Set<string>(BETA_TOPIC_INTERESTS.map((t) => t.slug));

/** Etiqueta de un slug marcado, o el propio valor si vino por "Other". */
export function topicInterestLabel(value: string): string {
  return BETA_TOPIC_INTERESTS.find((t) => t.slug === value)?.label ?? value;
}

/** true si el valor es un clic de la lista y no algo que alguien escribió. */
export function isListedTopicInterest(value: string | null | undefined): boolean {
  return SLUGS.has(String(value ?? "").trim());
}

/**
 * Cuántos puede elegir antes de que elegir deje de decir nada. Con siete
 * opciones, tres es la mitad larga: quien marca cinco de siete no ha elegido.
 */
export const MAX_TOPIC_INTERESTS = 3;
