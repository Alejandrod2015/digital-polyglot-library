/**
 * El filtro que separa el trafico PUBLICO del uso interno del Studio.
 *
 * Desde el 2026-09-24 `PageVisit` guarda tambien las paginas de `/studio`, que
 * antes se tiraban en el endpoint de registro. Eso permite saber que secciones
 * del menu se usan de verdad, pero obliga a que todo lo que hable de
 * VISITANTES las excluya: sin esto, el equipo navegando su propio panel
 * aparece como trafico.
 *
 * Quien lea `PageVisit` para contar gente de fuera spreadea esto en su `where`.
 * Quien lea para medir el uso del Studio usa `SOLO_STUDIO`.
 */
export const SIN_STUDIO = { path: { not: { startsWith: "/studio" } } } as const;

/** Lo contrario: solo el panel interno. */
export const SOLO_STUDIO = { path: { startsWith: "/studio" } } as const;
