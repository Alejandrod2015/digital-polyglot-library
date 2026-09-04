/**
 * Etiquetas de nivel que ve el usuario.
 *
 * El codigo interno se queda en `a0..c2`; lo que cambia es SOLO el nombre
 * visible. La decision viene de la investigacion del 2026-06-25 (deep research
 * mas ocho apps del sector) y su regla dura es que al usuario NUNCA se le
 * ensena "A0", "Pre-A1", "Level 0" ni "below A1": A0 no existe en el MCER, y
 * Pre-A1 es un hito parcial del Companion Volume asociado a ninos, asi que en
 * un adulto suena infantilizante.
 *
 * El codigo MCER se queda como anotacion secundaria, gris y pequena, y el nivel
 * de contacto cero no lleva ninguno, para no insinuar que hay algo "antes de
 * A1".
 */
export type LevelLabel = {
  /** Nombre visible, el que manda en la tarjeta. */
  name: string;
  /** Codigo MCER como anotacion secundaria. Vacio en el nivel de contacto cero. */
  cefr: string;
};

const LABELS: Record<string, LevelLabel> = {
  a0: { name: "Beginner", cefr: "" },
  a1: { name: "Elementary", cefr: "A1" },
  a2: { name: "Pre-Intermediate", cefr: "A2" },
  b1: { name: "Intermediate", cefr: "B1" },
  b2: { name: "Upper-Intermediate", cefr: "B2" },
  c1: { name: "Advanced", cefr: "C1" },
  c2: { name: "Mastery", cefr: "C2" },
};

/** Orden canonico, para ordenar listas de journeys por nivel. */
export const LEVEL_ORDER = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"];

export function levelLabel(id: string | null | undefined): LevelLabel {
  const key = (id ?? "").trim().toLowerCase();
  return LABELS[key] ?? { name: key.toUpperCase(), cefr: "" };
}

/** Posicion en la escalera; los desconocidos van al final. */
export function levelRank(id: string | null | undefined): number {
  const i = LEVEL_ORDER.indexOf((id ?? "").trim().toLowerCase());
  return i === -1 ? LEVEL_ORDER.length : i;
}
