// Lógica pura de _remeasureFragments.ts, extraída para poder testearla sin
// red ni base de datos. Ver el porqué en el archivo que la usa.

export type Frag = { index: number; startSec: number; endSec: number; text?: string; [k: string]: unknown };
export type W = { text: string; start?: number; end?: number; type?: string };

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Ancla cada fragmento (en orden) a un índice de `words`, avanzando un
 * cursor de izquierda a derecha. El índice devuelto SIEMPRE crece o se
 * mantiene (la búsqueda es hacia adelante desde el cursor, y el cursor solo
 * avanza), así que `inicios` en sí es monótono por construcción.
 */
export function anclarFragmentos(orden: Frag[], words: W[]): { inicios: number[]; sinAnclar: number[] } {
  const inicios: number[] = [];
  const sinAnclar: number[] = [];
  let cursor = 0;
  for (const f of orden) {
    const objetivo = norm(String(f.text ?? "")).split(" ").filter(Boolean);
    if (!objetivo.length) { inicios.push(cursor); continue; }
    const buscaClave = (largo: number): number => {
      const clave = objetivo.slice(0, Math.min(largo, objetivo.length));
      for (let i = cursor; i <= words.length - clave.length; i++) {
        let casan = true;
        for (let k = 0; k < clave.length; k++) {
          if (norm(words[i + k].text) !== clave[k]) { casan = false; break; }
        }
        if (casan) return i;
      }
      return -1;
    };
    let ini = buscaClave(3);
    if (ini < 0) ini = buscaClave(2);
    if (ini < 0) {
      const tope = Math.min(words.length, cursor + objetivo.length + 8);
      for (const larga of [...objetivo].sort((a, b) => b.length - a.length)) {
        if (larga.length < 5) break;
        for (let i = cursor; i < tope; i++) {
          if (norm(words[i].text) === larga) { ini = i; break; }
        }
        if (ini >= 0) break;
      }
    }
    if (ini < 0) { sinAnclar.push(f.index); ini = cursor; }
    inicios.push(ini);
    cursor = ini + Math.max(1, objetivo.length - 2);
  }
  return { inicios, sinAnclar };
}

/**
 * BUG arreglado (2026-09-14, une-liste-dans-la-tete): `anclarFragmentos`
 * ancla por INDICE de palabra, y ese indice si es monotono (la busqueda
 * solo avanza). Pero el tiempo que se GUARDA es `words[indice].start`, y
 * ahi es donde se rompia: el transcriptor (scribe_v1) no garantiza que
 * `words[i].start` crezca estrictamente con `i` cuando hay un tramo
 * dudoso (una palabra cortada, dos hablantes solapados en el limite de un
 * fragmento, un timestamp reetiquetado). En esta historia dos fragmentos
 * seguidos anclaron a indices CONSECUTIVOS cuyos tiempos venian
 * DESORDENADOS, y `_remeasureFragments` escribio un fragmento con
 * `endSec` menor que su propio `startSec` sin que nadie lo notara: el
 * unico chequeo existente (`assertCorteEnSilencio` / `enSilencio`)
 * verifica que el corte caiga en silencio, no que los limites vayan en
 * orden.
 *
 * El arreglo no intenta parchear al transcriptor (no se puede, es un
 * servicio externo): verifica la CONSECUENCIA observable sobre los
 * tiempos ya resueltos, antes de escribir nada, con el mismo criterio
 * "mejor no corregir que dejarlo peor" que ya usa el chequeo de silencio.
 */
export function tiemposDesordenados(
  orden: Frag[],
  inicios: number[],
  words: W[]
): number[] {
  const desorden: number[] = [];
  let ultimo = -Infinity;
  for (let n = 0; n < orden.length; n++) {
    const t = Number(words[inicios[n]]?.start ?? -Infinity);
    if (t < ultimo) desorden.push(orden[n].index);
    else ultimo = t;
  }
  return desorden;
}
