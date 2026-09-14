/**
 * Trinquete del gate de contexto REAL de glosas (`checkGlossContextReal.ts`).
 * Mismo patron que `gloss-context-baseline.json` / `gloss-chunk-baseline.json`:
 * la deuda de hoy no bloquea el push, pero solo puede bajar.
 *
 * Aqui la linea base NO es un numero: es el CONJUNTO de entradas malas
 * (`bundle|slug|palabra`), para que un hueco nuevo se distinga de uno viejo
 * aunque el total no cambie (una entrada vieja arreglada y una nueva rota
 * dan el mismo numero, pero son conjuntos distintos).
 */

export type LineaBaseGlossContext = Record<string, string[]>;

export function clavesDelBundle(bundle: string, baseline: LineaBaseGlossContext): Set<string> {
  return new Set(baseline[bundle] ?? []);
}

/** Compara el conjunto MEDIDO hoy para un bundle contra su linea base:
 *  `nuevos` son entradas malas que la linea base no conocia (bloquean),
 *  `viejos` son deuda ya congelada (no bloquean, se ven y solo pueden bajar). */
export function compararConLineaBase(
  bundle: string,
  actual: Set<string>,
  baseline: LineaBaseGlossContext
): { nuevos: string[]; viejos: string[] } {
  const base = clavesDelBundle(bundle, baseline);
  const nuevos: string[] = [];
  const viejos: string[] = [];
  for (const clave of actual) {
    if (base.has(clave)) viejos.push(clave);
    else nuevos.push(clave);
  }
  return { nuevos: nuevos.sort(), viejos: viejos.sort() };
}

/** Aprieta la linea base: la reemplaza por lo medido HOY, bundle por bundle,
 *  salvo los bundles en `excluir` (un journey que se esta rehaciendo en otro
 *  chat no se congela: tiene que salir a 0 por su cuenta). Bundles sin
 *  entradas malas no aparecen en la linea base (limpio de verdad, no "0
 *  registrado"). */
export function apretarLineaBase(
  medido: Record<string, Set<string>>,
  excluir: ReadonlySet<string>
): LineaBaseGlossContext {
  const nueva: LineaBaseGlossContext = {};
  for (const [bundle, claves] of Object.entries(medido)) {
    if (excluir.has(bundle)) continue;
    if (claves.size > 0) nueva[bundle] = [...claves].sort();
  }
  return nueva;
}
