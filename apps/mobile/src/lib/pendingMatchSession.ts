/**
 * La ronda de Match a medias sobrevive a salir y volver.
 *
 * Comportamiento que el usuario esperaba y no encontraba: "si veo que me queda
 * un ejercicio match por resolver, entro, fallo, salgo y vuelvo a entrar, espero
 * encontrar el MISMO ejercicio". Lo que pasaba es que en Match no existía la
 * sesión: `buildPracticeSession` hace `shuffle(remaining)` y reparte una mano
 * nueva desde las palabras vencidas en cada entrada. Comprobado ejecutando el
 * constructor real tres veces seguidas con sus favoritos: tres conjuntos
 * distintos. En `meaning`, en cambio, salía idéntico las tres veces, así que los
 * dos modos se comportaban distinto sin que nada lo anunciara.
 *
 * Aquí solo se guarda MATCH, que es el modo que barajaba. `meaning` ya era
 * estable y no se toca.
 *
 * Mismo patrón que `offlineStore`, `pendingReviewQueue` y `completedStories`:
 * sistema de archivos, no SecureStore (2 KB de tope en Android).
 */
import * as FileSystem from "expo-file-system/legacy";

const ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;

/** Una ronda caducada deja de tener sentido: las palabras ya vencieron otra vez. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingMatchSession<TExercise> = {
  exercises: TExercise[];
  /** Ejercicio en curso dentro de la ronda. */
  index: number;
  /** Parejas YA resueltas del ejercicio en curso. */
  matchedWords: string[];
  /** Aciertos acumulados, para que el marcador final no mienta. */
  score: number;
  savedAt: string;
};

export type PendingMatchState<TExercise> = {
  exercises: TExercise[];
  index: number;
  matchedWords: string[];
  score: number;
};

function sessionPath(userId: string | null | undefined): string {
  return `${ROOT}/pending-match-${userId ?? "guest"}.json`;
}

async function ensureRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
}

/** Devuelve la ronda pendiente, o null si no hay, está vacía o ha caducado. */
export async function loadPendingMatchSession<TExercise>(
  userId?: string | null
): Promise<PendingMatchState<TExercise> | null> {
  try {
    await ensureRoot();
    const path = sessionPath(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as PendingMatchSession<TExercise> | null;
    if (!parsed || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null;
    }
    const age = Date.now() - Date.parse(parsed.savedAt || "");
    if (!Number.isFinite(age) || age > MAX_AGE_MS) return null;
    return {
      exercises: parsed.exercises,
      index: Number.isInteger(parsed.index) ? parsed.index : 0,
      matchedWords: Array.isArray(parsed.matchedWords) ? parsed.matchedWords.map(String) : [],
      score: Number.isInteger(parsed.score) ? parsed.score : 0,
    };
  } catch {
    // Perder el fichero solo devuelve el comportamiento de antes (mano nueva).
    return null;
  }
}

export async function savePendingMatchSession<TExercise>(
  userId: string | null | undefined,
  state: PendingMatchState<TExercise>
): Promise<void> {
  if (!state?.exercises || state.exercises.length === 0) return;
  try {
    await ensureRoot();
    await FileSystem.writeAsStringAsync(
      sessionPath(userId),
      JSON.stringify({ ...state, savedAt: new Date().toISOString() })
    );
  } catch {
    // best effort
  }
}

/** Se llama al TERMINAR la ronda: a partir de ahí sí toca repartir de nuevo. */
export async function clearPendingMatchSession(
  userId?: string | null
): Promise<void> {
  try {
    const path = sessionPath(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // best effort
  }
}
