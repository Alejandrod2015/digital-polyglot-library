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
  byUser: Record<string, string[]>;
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
    const clean: Record<string, string[]> = {};
    for (const [userId, ids] of Object.entries(byUser)) {
      if (Array.isArray(ids)) clean[userId] = ids.filter((id): id is string => typeof id === "string");
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

export async function loadRatedStoryKeys(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const all = await readAll();
  return all.byUser[userId] ?? [];
}

export async function markStoryRated(userId: string | null, storyKey: string): Promise<void> {
  if (!userId || !storyKey || !FileSystem.documentDirectory) return;
  try {
    const all = await readAll();
    const current = all.byUser[userId] ?? [];
    if (current.includes(storyKey)) return;
    // Tope por cuenta: es una lista de "ya preguntado", no un historial. Las
    // más viejas se caen primero y, en el peor caso, alguien que lleve
    // cientos de historias vuelve a ver la pregunta en una que leyó hace
    // mucho, que es un fallo sin consecuencia.
    const next = [...current, storyKey].slice(-500);
    all.byUser[userId] = next;
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
