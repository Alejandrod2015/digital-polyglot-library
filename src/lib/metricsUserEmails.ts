// Resolve Clerk userIds to who está detrás, with a process-wide cache.
// Shared by the metrics dashboard and the notification-effectiveness lib so
// both surfaces resolve emails the same way (and share the cache).
//
// La caché guarda nombre y correo juntos porque salen de la MISMA llamada a
// Clerk: pedir el nombre aparte doblaría las peticiones para leer un campo
// que ya venía en la respuesta.

import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export type MetricsUserIdentity = { name: string | null; email: string | null };

const userCache = new Map<string, MetricsUserIdentity>();

/**
 * Nombre y correo de cada id. Quien entró con código por correo o con Apple
 * escondiendo el nombre no deja `firstName` en Clerk, y entonces el nombre es
 * null y manda el correo.
 */
export async function resolveUserIdentities(
  userIds: string[],
): Promise<Map<string, MetricsUserIdentity>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const byUserId = new Map<string, MetricsUserIdentity>();

  await Promise.all(
    unique.map(async (userId) => {
      const cached = userCache.get(userId);
      if (cached) {
        byUserId.set(userId, cached);
        return;
      }
      try {
        const user = await clerkClient.users.getUser(userId);
        const identity: MetricsUserIdentity = {
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
          email: user.emailAddresses[0]?.emailAddress ?? null,
        };
        userCache.set(userId, identity);
        byUserId.set(userId, identity);
      } catch (error) {
        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : null;
        // El 404 es una cuenta borrada que aún tiene filas de métricas: no es
        // un fallo del que avisar, es historia.
        if (status !== 404) {
          console.warn("resolveUserIdentities: failed to resolve Clerk user", userId, error);
        }
        const vacia: MetricsUserIdentity = { name: null, email: null };
        userCache.set(userId, vacia);
        byUserId.set(userId, vacia);
      }
    }),
  );

  return byUserId;
}

/** Solo el correo, que es lo que piden los paneles antiguos. */
export async function resolveUserEmails(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const identities = await resolveUserIdentities(userIds);
  const byUserId = new Map<string, string | null>();
  for (const [userId, identity] of identities) byUserId.set(userId, identity.email);
  return byUserId;
}
