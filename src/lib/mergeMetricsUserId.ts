/**
 * Fusiona la actividad de dos cuentas de Clerk que son la misma persona,
 * SOLO para que las métricas del Studio dejen de contarla dos veces.
 *
 * No toca Clerk, no toca `BillingEntitlement`, `RevokedUser`, `MobileDevice`
 * ni `EmailPreference`: la persona sigue con sus dos logins tal cual. Esto
 * es fusión de ANALÍTICA (userId único al agregar), no fusión de cuenta.
 *
 * Usado por `scripts/mergeMetricsUserId.ts` (CLI) y por
 * `/api/studio/beta/duplicates` (botón "Fusionar" del panel de duplicados).
 *
 * Tablas reescritas: UserMetric, UserStory, LibraryStory, LibraryBook,
 * ContinueListeningEntry, StoryRating. Donde hay unique(userId, X) y el
 * canónico ya tiene esa fila, se descarta la del alias en vez de romper la
 * constraint (con ContinueListeningEntry, se conserva la fila con
 * `lastPlayedAt` más reciente). Cada corrida queda registrada como un evento
 * `UserMetric` propio (no un archivo, que no sobrevive en producción).
 *
 * Recibe el cliente Prisma en vez de importarlo: `@/lib/prisma` es
 * `server-only` (no se puede cargar desde un script CLI plano), así que el
 * script pasa un `PrismaClient` crudo y la API route pasa el cliente de la
 * app con sus reintentos.
 */
import type { PrismaClient } from "@/generated/prisma";

// Tipado como el PrismaClient base y no como `PrismaClientWithRetry` (el
// cliente `$extends`-ido de `@/lib/prisma`) porque el tipo extendido rompe
// el overload de `$transaction`. La API route castea al pasar el suyo; solo
// cambia el tipo, el objeto en runtime sigue siendo el cliente con
// reintentos.
type Db = PrismaClient;

export type MergeMetricsResult = {
  userMetric: number;
  userStory: number;
  storyRating: number;
  libraryStory: { moved: number; skipped: number };
  libraryBook: { moved: number; skipped: number };
  continueListening: { moved: number; merged: number };
};

const MERGE_EVENT_TYPE = "admin_duplicate_metrics_merge";

export async function findPriorMerge(db: Db, aliasUserId: string) {
  return db.userMetric.findFirst({
    where: { eventType: MERGE_EVENT_TYPE, metadata: { path: ["alias"], equals: aliasUserId } },
  });
}

export async function mergeMetricsUserId(
  db: Db,
  aliasUserId: string,
  canonicalUserId: string,
): Promise<MergeMetricsResult> {
  if (aliasUserId === canonicalUserId) {
    throw new Error("alias y canónico son el mismo userId");
  }

  const prior = await findPriorMerge(db, aliasUserId);
  if (prior) {
    throw new Error(`ya fusionado antes (evento ${prior.id} el ${prior.createdAt.toISOString()})`);
  }

  const result = await db.$transaction(async (tx) => {
    const userMetric = await tx.userMetric.updateMany({
      where: { userId: aliasUserId },
      data: { userId: canonicalUserId },
    });
    const userStory = await tx.userStory.updateMany({
      where: { userId: aliasUserId },
      data: { userId: canonicalUserId },
    });
    const storyRating = await tx.storyRating.updateMany({
      where: { userId: aliasUserId },
      data: { userId: canonicalUserId },
    });

    // LibraryStory / LibraryBook: unique(userId, storyId|bookId). Si el
    // canónico ya la tiene guardada, se descarta la del alias.
    const libraryStoryRows = await tx.libraryStory.findMany({ where: { userId: aliasUserId } });
    let libraryStoryMoved = 0;
    let libraryStorySkipped = 0;
    for (const row of libraryStoryRows) {
      const exists = await tx.libraryStory.findUnique({
        where: { userId_storyId: { userId: canonicalUserId, storyId: row.storyId } },
      });
      if (exists) {
        await tx.libraryStory.delete({ where: { id: row.id } });
        libraryStorySkipped++;
      } else {
        await tx.libraryStory.update({ where: { id: row.id }, data: { userId: canonicalUserId } });
        libraryStoryMoved++;
      }
    }

    const libraryBookRows = await tx.libraryBook.findMany({ where: { userId: aliasUserId } });
    let libraryBookMoved = 0;
    let libraryBookSkipped = 0;
    for (const row of libraryBookRows) {
      const exists = await tx.libraryBook.findUnique({
        where: { userId_bookId: { userId: canonicalUserId, bookId: row.bookId } },
      });
      if (exists) {
        await tx.libraryBook.delete({ where: { id: row.id } });
        libraryBookSkipped++;
      } else {
        await tx.libraryBook.update({ where: { id: row.id }, data: { userId: canonicalUserId } });
        libraryBookMoved++;
      }
    }

    // ContinueListeningEntry: unique(userId, bookSlug, storySlug). Si hay
    // choque, gana la fila con lastPlayedAt más reciente.
    const cleRows = await tx.continueListeningEntry.findMany({ where: { userId: aliasUserId } });
    let cleMoved = 0;
    let cleMerged = 0;
    for (const row of cleRows) {
      const exists = await tx.continueListeningEntry.findUnique({
        where: {
          userId_bookSlug_storySlug: {
            userId: canonicalUserId,
            bookSlug: row.bookSlug,
            storySlug: row.storySlug,
          },
        },
      });
      if (exists) {
        if (row.lastPlayedAt > exists.lastPlayedAt) {
          await tx.continueListeningEntry.update({
            where: { id: exists.id },
            data: {
              progressSec: row.progressSec,
              audioDurationSec: row.audioDurationSec,
              lastPlayedAt: row.lastPlayedAt,
            },
          });
        }
        await tx.continueListeningEntry.delete({ where: { id: row.id } });
        cleMerged++;
      } else {
        await tx.continueListeningEntry.update({ where: { id: row.id }, data: { userId: canonicalUserId } });
        cleMoved++;
      }
    }

    const merged: MergeMetricsResult = {
      userMetric: userMetric.count,
      userStory: userStory.count,
      storyRating: storyRating.count,
      libraryStory: { moved: libraryStoryMoved, skipped: libraryStorySkipped },
      libraryBook: { moved: libraryBookMoved, skipped: libraryBookSkipped },
      continueListening: { moved: cleMoved, merged: cleMerged },
    };

    await tx.userMetric.create({
      data: {
        userId: canonicalUserId,
        storySlug: "admin",
        eventType: MERGE_EVENT_TYPE,
        metadata: { alias: aliasUserId, canon: canonicalUserId, result: merged },
      },
    });

    return merged;
  });

  return result;
}
