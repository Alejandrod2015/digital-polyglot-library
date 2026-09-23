import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { getStudioMembers, isStudioMember } from "@/lib/studio-access";
import { isInternalDomain } from "@/lib/internalAccounts";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// Cache the resolved internal-user list so we don't hit Clerk on every
// dashboard query. The studio team rarely changes and stale entries here
// only mean a few extra/missing rows in the dashboard, not security harm.
type InternalIdsCache = { ids: string[]; loadedAt: number };
let internalIdsCache: InternalIdsCache | null = null;
const INTERNAL_IDS_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the Clerk userIds to exclude from /api/metrics/* dashboards
 * so the numbers reflect external usage only. Two sources are merged:
 *
 *   1) `getStudioMembers()` emails -> Clerk userIds (lookup by email).
 *      Catches anyone who registered with the same email used on the
 *      studio team table.
 *   2) `METRICS_EXCLUDE_USER_IDS` env var (comma-separated). Manual
 *      fallback for testers whose Clerk profile uses a different
 *      email than the studio team table, or for legacy/deleted Clerk
 *      users who still own historical metric rows.
 *
 * Cached for 5 minutes.
 */
export async function getInternalUserIds(): Promise<string[]> {
  if (
    internalIdsCache &&
    Date.now() - internalIdsCache.loadedAt < INTERNAL_IDS_TTL_MS
  ) {
    return internalIdsCache.ids;
  }
  const members = await getStudioMembers();
  // `METRICS_INTERNAL_EMAILS` cuenta tambien aqui, no solo en el resumen
  // semanal: son dos listas que hasta hoy no coincidian, asi que un correo
  // apuntado ahi seguia contando como usuario real en el panel. Sirve para
  // cuentas del equipo que NO deben tener acceso al Studio, que es lo que
  // implicaria darles fila en studio_members.
  const extraEmails = (process.env.METRICS_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emails = Array.from(
    new Set([...members.map((m) => m.email.trim().toLowerCase()), ...extraEmails]),
  ).filter(Boolean);

  const ids: string[] = [];
  for (const email of emails) {
    try {
      const list = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 10,
      });
      for (const user of list.data) {
        ids.push(user.id);
      }
    } catch (error) {
      console.warn("[metricsAccess] failed to resolve internal user", email, error);
    }
  }

  // Una sola pasada por Clerk que recoge dos exclusiones.
  // Cuentas marcadas en Clerk como fuera de la analítica
  // (`publicMetadata.analyticsExcluded`). La bandera ya existía y la
  // respetaban el pixel de Meta y GA4, pero el panel no la miraba: la cuenta
  // de revisión de Google Play la llevaba puesta desde marzo y aun así salía
  // como usuario activo cada vez que los revisores entraban con las
  // credenciales de demo. Marcar la cuenta en Clerk basta ahora para que
  // desaparezca de todas las pestañas, sin apuntar su id a mano.
  try {
    const total = await clerkClient.users.getCount();
    for (let offset = 0; offset < total && offset < 2000; offset += 100) {
      const page = await clerkClient.users.getUserList({ limit: 100, offset });
      for (const user of page.data) {
        const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
        if (meta.analyticsExcluded === true) ids.push(user.id);
        // Y el dominio de la empresa, la MISMA regla que el ingest de
        // metricas aplica al sellar cada fila con `internal`. Las dos
        // definiciones llevaban meses divergiendo: una cuenta
        // @digitalpolyglot.com que no estuviera en `studio_members`
        // quedaba marcada como interna en su propia fila y aun asi contaba
        // como usuario activo en el panel. El 2026-09-16 dos de ellas
        // salieron dentro del DAU. Se aprovecha esta misma pagina, asi que
        // no cuesta ni una peticion mas.
        const email =
          user.primaryEmailAddress?.emailAddress ??
          user.emailAddresses?.[0]?.emailAddress ??
          null;
        if (isInternalDomain(email)) ids.push(user.id);
      }
      if (page.data.length < 100) break;
    }
  } catch (error) {
    console.warn("[metricsAccess] failed to list Clerk users for analyticsExcluded", error);
  }

  // ── El sello que el ingest ya escribió ──
  // Cada fila de `UserMetric` se sella con `metadata.internal` en el momento
  // de escribirla, con la regla de `isInternalEmail` (dominio de la empresa
  // más `studio_members`). Todo lo de arriba, en cambio, se resuelve EN VIVO
  // contra Clerk, y las dos cosas no dicen lo mismo en cuanto el presente
  // deja de parecerse al pasado:
  //
  //   - alguien que estuvo en `studio_members` y ya no está: sus filas viejas
  //     siguen selladas como internas, y la lista en vivo ya no lo nombra;
  //   - una cuenta borrada de Clerk: sus filas siguen ahí y el `getUserList`
  //     por correo no puede devolver un id que ya no existe.
  //
  // En los dos casos el panel contaba como externo a alguien que el ingest
  // había marcado de casa. El 2026-09-23 esa grieta daba 39 practicantes
  // contando por el sello y 40 contando por el panel. El sello gana porque
  // sabe lo que era cierto cuando el evento ocurrió, que es justo lo que la
  // lista en vivo no puede reconstruir.
  //
  // `groupBy` y no `findMany({ distinct })`: el segundo se trae TODAS las
  // filas selladas y deduplica después, y son filas de eventos, no de
  // personas. Seis cuentas de casa con meses de uso son decenas de miles de
  // filas para sacar seis ids.
  //
  // CUIDADO: basta UNA fila sellada para excluir a esa persona entera, en
  // todo el rango y para siempre. Es a propósito (quien fue de casa un mes no
  // vuelve a ser señal externa el siguiente), pero un sello mal puesto no se
  // corrige solo: hay que quitar la marca de esas filas.
  try {
    const sellados = await prisma.userMetric.groupBy({
      by: ["userId"],
      where: { metadata: { path: ["internal"], equals: true } },
    });
    for (const fila of sellados) ids.push(fila.userId);
  } catch (error) {
    console.warn("[metricsAccess] no se pudo leer el sello metadata.internal", error);
  }

  // Manual override: tester userIds set in Vercel env. Useful for
  // accounts whose Clerk email doesn't match the studio_members row,
  // or for stale/deleted Clerk users that still have rows in
  // UserMetric we want to ignore.
  const manualEnv = process.env.METRICS_EXCLUDE_USER_IDS ?? "";
  for (const id of manualEnv.split(",").map((s) => s.trim()).filter(Boolean)) {
    ids.push(id);
  }

  const unique = Array.from(new Set(ids));
  internalIdsCache = { ids: unique, loadedAt: Date.now() };
  return unique;
}

export async function isMetricsAccessAllowed(req: NextRequest): Promise<boolean> {
  // Always allow in dev
  if (process.env.NODE_ENV !== "production") return true;

  // Check API key first (fast path for external tools)
  const expectedKey = process.env.METRICS_DASHBOARD_KEY;
  if (expectedKey) {
    const headerKey = req.headers.get("x-metrics-key")?.trim();
    const queryKey = req.nextUrl.searchParams.get("key")?.trim();
    const providedKey = headerKey || queryKey;
    if (providedKey && providedKey === expectedKey) return true;
  }

  // Check studio membership via Clerk user email
  const { userId } = getAuth(req);
  if (!userId) return false;

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return false;
    return isStudioMember(email);
  } catch {
    return false;
  }
}
