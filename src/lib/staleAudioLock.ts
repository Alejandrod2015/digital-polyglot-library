/**
 * `JourneyStory.audioStatus = "generating"` es un candado, y como todo
 * candado se queda puesto si el proceso que lo tomo muere. La ruta de audio
 * lo libera en su `catch` (pasa a "failed"), pero un timeout de la funcion,
 * un deploy a mitad de render o un proceso local matado no ejecutan ese
 * catch: el 2026-07-22 quedaron 18 historias de Friends Argentina marcadas
 * como "generando" durante 6 dias, sin audio y sin haberse tocado.
 *
 * Nada bloquea por ese estado, asi que el dano es de informacion: el monitor
 * del studio muestra un punto de "en curso" que no lo esta, y cualquier
 * recuento de historias listas queda mal. La cura es no confiar en el
 * candado pasado cierto tiempo.
 */

/**
 * Un render de audio real se resuelve en minutos. Una hora es holgado de
 * sobra para el peor caso (multivoz largo con reintentos) y sigue siendo
 * mucho menos que los dias que duraba el candado colgado.
 */
export const AUDIO_LOCK_TTL_MS = 60 * 60 * 1000;

/**
 * Devuelve el `audioStatus` que hay que MOSTRAR: si el candado esta caducado,
 * la historia no se esta generando, sigue pendiente. No escribe en la base;
 * es una lectura honesta sobre el dato crudo.
 */
export function effectiveAudioStatus(
  audioStatus: string | null | undefined,
  updatedAt: Date | string | null | undefined,
  now: number = Date.now()
): string {
  const estado = audioStatus ?? "pending";
  if (estado !== "generating") return estado;
  if (!updatedAt) return estado;
  const t = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return estado;
  return now - t > AUDIO_LOCK_TTL_MS ? "pending" : estado;
}

/** True si la fila lleva colgada mas de lo permitido (para limpiarla). */
export function isStaleAudioLock(
  audioStatus: string | null | undefined,
  updatedAt: Date | string | null | undefined,
  now: number = Date.now()
): boolean {
  return audioStatus === "generating" && effectiveAudioStatus(audioStatus, updatedAt, now) === "pending";
}
