import * as FileSystem from "expo-file-system/legacy";

/**
 * Qué historias ha valorado ya cada cuenta, en disco.
 *
 * Sin esto la pregunta reaparece cada vez que alguien vuelve a abrir una
 * historia que ya puntuó, que es la forma más rápida de convertir una
 * pregunta amable en ruido. El servidor deduplica igualmente (upsert por
 * userId + slug), pero eso solo evita filas duplicadas: quien decide si la
 * fila de pulgares se PINTA es este fichero.
 *
 * Va indexado por usuario porque en un mismo dispositivo se prueban varias
 * cuentas y lo que valoró una no debe silenciar la pregunta a la otra.
 */

const STORAGE_FILE = `${FileSystem.documentDirectory ?? ""}story-ratings.json`;

type StoredPayload = {
  version: 1;
  /** slug de la historia -> pulgar. Antes era una lista de slugs, sin el
   *  sentido del voto; hacía falta el valor para poder pintar marcado el
   *  pulgar elegido al volver a la pantalla. Las listas viejas se migran
   *  al leerlas, contando cada slug como pulgar arriba desconocido: se
   *  respeta que ya votó y se le deja cambiarlo de un toque. */
  byUser: Record<string, Record<string, boolean>>;
  /** Cuentas a las que ya se les preguntó al cerrar el panel. Una vez y nunca más. */
  closeAskedByUser?: Record<string, boolean>;
};

const EMPTY: StoredPayload = { version: 1, byUser: {}, closeAskedByUser: {} };

async function readAll(): Promise<StoredPayload> {
  if (!FileSystem.documentDirectory) return EMPTY;
  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) return EMPTY;
    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    const byUser = parsed?.byUser;
    if (!byUser || typeof byUser !== "object") return EMPTY;
    const clean: Record<string, Record<string, boolean>> = {};
    for (const [userId, value] of Object.entries(byUser)) {
      if (Array.isArray(value)) {
        // Formato viejo: lista de slugs.
        clean[userId] = Object.fromEntries(
          value.filter((id): id is string => typeof id === "string").map((id) => [id, true]),
        );
      } else if (value && typeof value === "object") {
        clean[userId] = Object.fromEntries(
          Object.entries(value as Record<string, unknown>).filter(
            (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
          ),
        );
      }
    }
    const asked = parsed.closeAskedByUser;
    return {
      version: 1,
      byUser: clean,
      closeAskedByUser: asked && typeof asked === "object" ? (asked as Record<string, boolean>) : {},
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Clave de disco para un voto. La práctica se guarda aparte de la historia,
 * con el mismo slug: son dos preguntas distintas y el pulgar de una no puede
 * pintar marcada a la otra.
 */
export function ratingStorageKey(storySlug: string, surface: "story" | "practice"): string {
  return surface === "practice" ? `practice:${storySlug}` : storySlug;
}

/** Voto guardado por clave: true pulgar arriba, false abajo, ausente sin votar. */
export async function loadRatedStoryVotes(
  userId: string | null,
): Promise<Record<string, boolean>> {
  if (!userId) return {};
  const all = await readAll();
  return all.byUser[userId] ?? {};
}

export async function markStoryRated(
  userId: string | null,
  storyKey: string,
  liked: boolean,
): Promise<void> {
  if (!userId || !storyKey || !FileSystem.documentDirectory) return;
  try {
    const all = await readAll();
    const current = all.byUser[userId] ?? {};
    if (current[storyKey] === liked) return;
    // Tope por cuenta: esto no es un historial, es lo justo para pintar el
    // pulgar marcado al volver. Las más viejas se caen primero.
    const entries = Object.entries({ ...current, [storyKey]: liked }).slice(-500);
    all.byUser[userId] = Object.fromEntries(entries);
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(all));
  } catch {
    // Fallar aquí solo significa volver a preguntar; nunca romper el lector.
  }
}

/** ¿Ya se le preguntó a esta cuenta al cerrar el panel? */
export async function hasCloseAskBeenUsed(userId: string | null): Promise<boolean> {
  if (!userId) return true;
  const all = await readAll();
  return Boolean(all.closeAskedByUser?.[userId]);
}

/** Marca la pregunta de cierre como gastada. No se repite en toda la vida de la cuenta. */
export async function markCloseAskUsed(userId: string | null): Promise<void> {
  if (!userId || !FileSystem.documentDirectory) return;
  try {
    const all = await readAll();
    all.closeAskedByUser = { ...(all.closeAskedByUser ?? {}), [userId]: true };
    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(all));
  } catch {
    // Igual que arriba: fallar aquí solo significa volver a preguntar una vez.
  }
}
