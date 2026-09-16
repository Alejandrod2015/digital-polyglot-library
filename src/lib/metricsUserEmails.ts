// Resolve Clerk userIds to who está detrás, with a process-wide cache.
// Shared by the metrics dashboard and the notification-effectiveness lib so
// both surfaces resolve emails the same way (and share the cache).
//
// La caché guarda nombre y correo juntos porque salen de la MISMA llamada a
// Clerk: pedir el nombre aparte doblaría las peticiones para leer un campo
// que ya venía en la respuesta.
//
// Dos cosas que costaron una investigación el 2026-09-16 y que el diseño de
// aquí tiene que sostener:
//
//  1. Una cuenta BORRADA sigue teniendo filas en `UserMetric`, así que su id
//     llega hasta aquí y Clerk no la conoce. Eso no es lo mismo que un fallo
//     de red, y quien pinta la respuesta necesita poder decir la diferencia:
//     por eso `status`, y no un `null` que sirve para las dos cosas.
//  2. Un fallo PASAJERO (429, 500, red) no se cachea. Antes sí, y como la
//     caché no caduca, un solo hipo dejaba a una persona real sin nombre
//     hasta el siguiente despliegue de esa instancia.

import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/**
 * `ok`: Clerk contestó y la cuenta existe.
 * `deleted`: Clerk contestó y la cuenta no existe. Sus métricas son historia.
 * `unavailable`: no se pudo preguntar. Puede que la cuenta esté perfectamente.
 */
export type MetricsIdentityStatus = "ok" | "deleted" | "unavailable";

export type MetricsUserIdentity = {
  name: string | null;
  email: string | null;
  status: MetricsIdentityStatus;
};

/** Solo se cachea lo que no va a cambiar solo: `ok` y `deleted`. */
const userCache = new Map<string, MetricsUserIdentity>();

/** Cuántos ids caben en una consulta de lista de Clerk. */
const BATCH = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Nombre y correo de cada id. Quien entró con código por correo o con Apple
 * escondiendo el nombre no deja `firstName` en Clerk, y entonces el nombre es
 * null y manda el correo.
 *
 * Se pide por LOTES (`getUserList` con hasta 100 ids) en vez de un `getUser`
 * por persona: nueve nombres eran nueve peticiones, y ese volumen es
 * justamente el que se come el límite de Clerk y provoca el caso 2 de arriba.
 * Los ids que el lote no devuelve son los que Clerk no conoce, que es la
 * definición de cuenta borrada.
 */
export async function resolveUserIdentities(
  userIds: string[],
): Promise<Map<string, MetricsUserIdentity>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const byUserId = new Map<string, MetricsUserIdentity>();

  const pendientes: string[] = [];
  for (const userId of unique) {
    const cached = userCache.get(userId);
    if (cached) byUserId.set(userId, cached);
    else pendientes.push(userId);
  }

  await Promise.all(
    chunk(pendientes, BATCH).map(async (lote) => {
      try {
        const list = await clerkClient.users.getUserList({ userId: lote, limit: BATCH });
        const vistos = new Set<string>();
        for (const user of list.data) {
          vistos.add(user.id);
          const identity: MetricsUserIdentity = {
            name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
            email:
              user.primaryEmailAddress?.emailAddress ??
              user.emailAddresses[0]?.emailAddress ??
              null,
            status: "ok",
          };
          userCache.set(user.id, identity);
          byUserId.set(user.id, identity);
        }
        // Lo que el lote no trajo, Clerk no lo tiene. Es una cuenta borrada
        // que aún conserva sus filas de métricas: no es un fallo del que
        // avisar, es historia, y se cachea porque no va a volver.
        for (const userId of lote) {
          if (vistos.has(userId)) continue;
          const borrada: MetricsUserIdentity = { name: null, email: null, status: "deleted" };
          userCache.set(userId, borrada);
          byUserId.set(userId, borrada);
        }
      } catch (error) {
        console.warn("resolveUserIdentities: no se pudo preguntar a Clerk", lote.length, error);
        // A propósito SIN cachear: la siguiente petición lo reintenta.
        for (const userId of lote) {
          byUserId.set(userId, { name: null, email: null, status: "unavailable" });
        }
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
