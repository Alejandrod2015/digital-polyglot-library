/**
 * Historias cuyo AUDIO se ha terminado alguna vez, persistidas en disco.
 *
 * La tarjeta de práctica del lector se desbloquea al terminar el audio, pero
 * ese estado vivía solo en un `useState`: bastaba salir de la historia para
 * que se perdiera, así que una historia escuchada AYER no ofrecía práctica
 * hasta reescucharla entera. El propio comentario del lector lo dejaba
 * escrito como PENDIENTE. Este módulo es ese pendiente.
 *
 * Se guarda la señal canónica y solo esa: el `didJustFinish` del reproductor.
 * NO se deriva de `progressRatio`, porque ese valor lo escriben por igual el
 * scroll del usuario y el avance del audio, y deslizar hasta el final sin
 * reproducir nada lo deja en ~1.0. Sembrar de ahí desbloquearía la práctica
 * sin haber escuchado, que es justo lo que la condición existe para evitar.
 *
 * Misma raíz y mismo patrón que `offlineStore` y `pendingReviewQueue`: sistema
 * de archivos, no SecureStore, que tiene 2 KB de tope en Android.
 */
import * as FileSystem from "expo-file-system/legacy";

const ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;

function completedPath(userId: string | null | undefined): string {
  return `${ROOT}/completed-stories-${userId ?? "guest"}.json`;
}

async function ensureRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
}

/** Ids de historia con el audio terminado. Vacío ante cualquier problema. */
export async function loadCompletedStories(
  userId?: string | null
): Promise<Set<string>> {
  try {
    await ensureRoot();
    const path = completedPath(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return new Set();
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    // Perder el fichero solo devuelve el comportamiento de antes (hay que
    // reescuchar), nunca rompe el lector.
    return new Set();
  }
}

/** Marca una historia como terminada. Idempotente. */
export async function markStoryCompleted(
  userId: string | null | undefined,
  storyId: string
): Promise<void> {
  if (!storyId) return;
  try {
    const current = await loadCompletedStories(userId);
    if (current.has(storyId)) return;
    current.add(storyId);
    await ensureRoot();
    await FileSystem.writeAsStringAsync(
      completedPath(userId),
      JSON.stringify([...current])
    );
  } catch {
    // best effort
  }
}
