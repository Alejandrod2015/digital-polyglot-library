/**
 * Cola de repasos que no llegaron al servidor.
 *
 * El estado local de repetición espaciada YA sobrevive sin red: se calcula y se
 * guarda en el dispositivo. Lo que se perdía era la escritura al servidor:
 * `updateFavoriteReviewOnServer` se intentaba una vez y, al fallar, el catch se
 * la tragaba con un "keep local SRS state". Practicabas en el metro y el
 * servidor no se enteraba jamás.
 *
 * No hay regla de desempate a propósito. Cada repaso es un EVENTO con su hora,
 * no una versión de un hecho, así que dos repasos de la misma palabra no
 * compiten: ocurrieron los dos. Se reproducen en orden cronológico y el
 * servidor queda como si nunca hubiera habido desconexión.
 */
import * as FileSystem from "expo-file-system/legacy";

// Misma raíz que offlineStore, para no repartir el estado offline en dos sitios.
const ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;

export type PendingReview = {
  word: string;
  nextReviewAt: string;
  /** Momento REAL del repaso. Es la clave del orden de reproducción. */
  lastReviewedAt: string;
  streak: number;
};

function queuePath(userId: string): string {
  return `${ROOT}/pending-reviews-${userId}.json`;
}

async function ensureRoot(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  }
}

export async function loadPendingReviews(userId: string): Promise<PendingReview[]> {
  if (!userId) return [];
  await ensureRoot();
  const path = queuePath(userId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return [];
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as { pending?: PendingReview[] };
    return Array.isArray(parsed?.pending) ? parsed.pending : [];
  } catch {
    return [];
  }
}

async function writePendingReviews(userId: string, pending: PendingReview[]): Promise<void> {
  await ensureRoot();
  try {
    await FileSystem.writeAsStringAsync(
      queuePath(userId),
      JSON.stringify({ pending, savedAt: new Date().toISOString() })
    );
  } catch {
    // Best-effort. Perder la cola devuelve el comportamiento de antes (el
    // repaso se queda solo en local), nunca rompe la sesión en curso.
  }
}

/** Encola repasos que no pudieron subir. Se acumulan; no se sobrescriben. */
export async function enqueuePendingReviews(
  userId: string,
  reviews: PendingReview[]
): Promise<void> {
  if (!userId || reviews.length === 0) return;
  const current = await loadPendingReviews(userId);
  await writePendingReviews(userId, [...current, ...reviews]);
}

/**
 * Reproduce la cola en ORDEN CRONOLÓGICO por `lastReviewedAt`. Los que suben
 * se descartan; los que vuelven a fallar se conservan para el próximo intento,
 * así que un servidor caído no borra el progreso de nadie.
 */
export async function flushPendingReviews(
  userId: string,
  send: (review: PendingReview) => Promise<void>
): Promise<{ sent: number; remaining: number }> {
  const pending = await loadPendingReviews(userId);
  if (pending.length === 0) return { sent: 0, remaining: 0 };

  const ordered = [...pending].sort(
    (a, b) => Date.parse(a.lastReviewedAt || "") - Date.parse(b.lastReviewedAt || "")
  );

  const failed: PendingReview[] = [];
  let sent = 0;
  for (const review of ordered) {
    try {
      await send(review);
      sent += 1;
    } catch {
      // En cuanto uno falla, el resto se conserva SIN intentar: seguir
      // enviando rompería el orden cronológico, que es justo lo que esta
      // cola existe para preservar.
      failed.push(review, ...ordered.slice(ordered.indexOf(review) + 1));
      break;
    }
  }

  await writePendingReviews(userId, failed);
  return { sent, remaining: failed.length };
}
