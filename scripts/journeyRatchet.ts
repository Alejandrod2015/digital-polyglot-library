import type { JourneyCheck } from "@/lib/validateJourneyStories";

/**
 * ¿La edición empeora esta regla de conjunto respecto a como estaba?
 *
 * Conservador a propósito: devuelve "empeora" siempre que no pueda demostrar
 * lo contrario. Cuatro casos y ninguno más:
 *
 *   1. Antes pasaba y ahora no        -> EMPEORA. Sin excepción.
 *   2. El detalle es idéntico          -> igual. La edición no la tocó.
 *   3. Los dos detallan historias, y   -> igual o mejor. Ninguna historia
 *      las de ahora son un subconjunto    nueva entra en la lista de fallos.
 *      de las de antes
 *   4. Cualquier otra cosa             -> EMPEORA.
 *
 * Se compara por SLUG y no por los números del detalle porque el sentido de
 * un número depende de la regla: en `journey-quoted-speech-band` un 3% es
 * peor que un 7%, y en `journey-closing-alone` 17 es peor que 12. El conjunto
 * de historias señaladas, en cambio, significa lo mismo en todas.
 *
 * EXCEPCION MEDIDA (2026-09-08): ese heuristico asume que la lista de
 * infractores es ESTABLE, y hay reglas que no la tienen. En
 * `journey-vocab-worth-teaching` el detalle dice "donde mas se acumula": al
 * arreglar las cuatro peores historias aparecen otras cuatro, que se leen
 * como slugs NUEVOS y declaran EMPEORA una edicion que baja la media de 2,48
 * a 2,10. Ahi el numero SI es comparable y ademas es el propio umbral de la
 * regla, asi que para las reglas de MAGNITUD DECLARADA (las que abren su
 * detalle con `media N`) se compara la media, y bajarla es mejorar. Sin esto
 * ninguna regla de journey que se arregle POR ACUMULACION puede repararse a
 * plazos: no existe orden de guardado con un estado intermedio valido.
 */
const MAGNITUD = /(?:^|\s)media\s+([0-9]+(?:[.,][0-9]+)?)/i;

export function empeora(antes: JourneyCheck | undefined, ahora: JourneyCheck, slugs: string[]): boolean {
  if (!antes || antes.status === "pass") return true;
  const da = (antes.detail ?? "").trim();
  const dh = (ahora.detail ?? "").trim();
  // MAGNITUD DECLARADA (2026-09-08): la regla dice su numero y hacia donde se
  // mejora. Es mas fiable que leerlo de la prosa del detalle y sirve para las
  // dos direcciones: una media de color mejora BAJANDO, un suelo de nivel
  // mejora SUBIENDO. Sin esto el suelo de nivel tampoco se podia reparar a
  // plazos, porque su detalle no lista slugs sino palabras.
  if (antes.magnitud && ahora.magnitud && antes.magnitud.mejor === ahora.magnitud.mejor) {
    return ahora.magnitud.mejor === "baja"
      ? ahora.magnitud.valor > antes.magnitud.valor
      : ahora.magnitud.valor < antes.magnitud.valor;
  }
  if (da === dh) return false;
  const ma = da.match(MAGNITUD);
  const mh = dh.match(MAGNITUD);
  if (ma && mh) {
    const na = Number(ma[1].replace(",", "."));
    const nh = Number(mh[1].replace(",", "."));
    if (Number.isFinite(na) && Number.isFinite(nh)) return nh > na;
  }
  const mencionadas = (d: string) => new Set(slugs.filter((s) => d.includes(s)));
  const A = mencionadas(da);
  const H = mencionadas(dh);
  if (A.size === 0 || H.size === 0) return true;
  if (H.size > A.size) return true;
  for (const s of H) if (!A.has(s)) return true;
  return false;
}
