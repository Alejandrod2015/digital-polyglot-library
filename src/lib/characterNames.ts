/**
 * Nombres de personaje por variante, con su GENERACIÓN.
 *
 * POR QUÉ EXISTE (2026-08-14). Las tres historias nuevas del A0 portugués
 * salieron con Célia, Márcia, Zeca e Iara. Suenan brasileños, y por eso pasaron
 * todos los checks, pero ninguno es un nombre de persona joven hoy: Célia y
 * Márcia son de los años cincuenta y sesenta, Zeca es el diminutivo de José que
 * se asocia a un hombre mayor, e Iara es una figura del folclore antes que un
 * nombre corriente. Los elegí a ojo, sin ningún dato, y el resultado es un
 * reparto que suena a la generación de los abuelos de los personajes.
 *
 * El reparto tiene que sonar a la edad que tienen los personajes. Estas listas
 * son de nombres frecuentes entre adultos jóvenes, que es la franja de los
 * protagonistas (ni niños ni ancianos, `feedback_no_elderly_no_children`).
 *
 * NO es una lista cerrada de nombres permitidos: es la referencia contra la que
 * el validador AVISA. Un nombre fuera de lista puede ser correcto, pero obliga a
 * justificarlo en vez de aceptarlo por sonar bien.
 */

export type NameBank = {
  /** Frecuentes hoy entre adultos jóvenes (20-40). El reparto por defecto. */
  young: string[];
  /** Reconocibles pero de generaciones anteriores. Solo para personajes mayores. */
  older: string[];
};

export const CHARACTER_NAMES: Record<string, NameBank> = {
  // Brasil. Frecuentes entre adultos jóvenes; los `older` son los que sonaban
  // a otra época en las historias del A0 portugués.
  "portuguese/brazil": {
    young: [
      "Beatriz", "Camila", "Larissa", "Amanda", "Juliana", "Mariana", "Letícia",
      "Gabriela", "Rafaela", "Bruna", "Carolina", "Isabela", "Natália", "Vitória",
      "Lucas", "Gabriel", "Rafael", "Bruno", "Felipe", "Thiago", "Matheus",
      "Gustavo", "Rodrigo", "Leonardo", "Vinícius", "André", "Diego", "Caio",
    ],
    older: ["Célia", "Márcia", "Zeca", "Cláudia", "Sônia", "Wilson", "Vera", "Jorge"],
  },
  "portuguese/portugal": {
    young: ["Inês", "Beatriz", "Matilde", "Carolina", "Rita", "Joana", "Tiago", "Diogo", "Rodrigo", "Miguel", "Duarte", "Gonçalo"],
    older: ["Fernanda", "Manuel", "Conceição", "Joaquim"],
  },
  "spanish/spain": {
    young: ["Lucía", "Martina", "Paula", "Claudia", "Alba", "Carla", "Hugo", "Pablo", "Álvaro", "Mateo", "Marcos", "Iván"],
    older: ["Amparo", "Vicente", "Encarna", "Paco"],
  },
  "spanish/latam": {
    young: ["Valentina", "Camila", "Sofía", "Mariana", "Antonella", "Matías", "Santiago", "Benjamín", "Nicolás", "Emiliano"],
    older: ["Rosario", "Hernán", "Graciela", "Ramón"],
  },
  "german/germany": {
    young: ["Lena", "Marie", "Sophie", "Emilia", "Hannah", "Jonas", "Leon", "Finn", "Elias", "Noah"],
    older: ["Ingrid", "Helmut", "Ursula", "Dieter"],
  },
  "italian/italy": {
    young: ["Giulia", "Sofia", "Chiara", "Martina", "Alessandro", "Lorenzo", "Matteo", "Riccardo"],
    older: ["Rosa", "Giuseppe", "Carmela", "Ennio"],
  },
  // Francia. El banco faltaba entero y el primer journey francés (Expat A0,
  // Lyon) se escribió sin él, así que ningún nombre se contrastaba con nada.
  "french/france": {
    young: [
      "Manon", "Camille", "Chloé", "Léa", "Louise", "Clara", "Pauline", "Juliette",
      "Hugo", "Théo", "Maxime", "Antoine", "Julien", "Baptiste", "Nicolas", "Romain",
    ],
    older: ["Martine", "Françoise", "Sylvie", "Michel", "Bernard", "Gérard"],
  },
};

/** Clave del banco a partir del idioma y la variante del journey. */
export function nameBankKey(language: string | null | undefined, variant: string | null | undefined): string {
  return `${(language ?? "").trim().toLowerCase()}/${(variant ?? "").trim().toLowerCase()}`;
}

export function getNameBank(language: string | null | undefined, variant: string | null | undefined): NameBank | null {
  return CHARACTER_NAMES[nameBankKey(language, variant)] ?? null;
}

/**
 * Clasifica un nombre contra el banco de su región.
 * `unknown` no significa incorrecto: significa que nadie lo ha comprobado.
 */
export function classifyName(
  name: string,
  language: string | null | undefined,
  variant: string | null | undefined
): "young" | "older" | "unknown" {
  const bank = getNameBank(language, variant);
  if (!bank) return "unknown";
  const n = name.trim().toLowerCase();
  if (bank.young.some((x) => x.toLowerCase() === n)) return "young";
  if (bank.older.some((x) => x.toLowerCase() === n)) return "older";
  return "unknown";
}
