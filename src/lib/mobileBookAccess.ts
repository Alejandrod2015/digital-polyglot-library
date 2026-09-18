import type { BillingEntitlement } from "@/generated/prisma";
import { serializeEntitlement } from "@/lib/billing";
import {
  canReadWholeBook,
  getOwnedBooks,
  resolveEffectivePlan,
  type Plan,
} from "@domain/access";

/**
 * Decide si una cuenta puede abrir un libro ENTERO del catalogo desde la app.
 *
 * WHY (2026-09-18, auditoria de seguridad, hallazgo critico #2): la ruta
 * `/api/mobile/book/[slug]` tomaba la fila `LibraryBook` como prueba de
 * compra, y esa fila la podia crear cualquier sesion movil con un POST a
 * `/api/mobile/library` mandando el `bookId` que quisiera. La propiedad real
 * vive donde la escribe el claim (`publicMetadata.books` en Clerk) y en el
 * plan (BillingEntitlement o `publicMetadata.plan`); es la misma regla que
 * aplica la web en `canReadWholeBook`, con la gracia beta de
 * `resolveEffectivePlan` para no cerrar la puerta a las cuentas pre-muro.
 *
 * Funcion pura: la ruta trae los datos y esta decide. Asi el test cubre la
 * decision sin levantar Clerk ni Prisma.
 */
export function decideMobileBookAccess(opts: {
  publicMetadata: unknown;
  entitlement: BillingEntitlement | null;
  userCreatedAtMs: number | null;
  bookSlug: string;
}): boolean {
  const { publicMetadata, entitlement, userCreatedAtMs, bookSlug } = opts;
  const meta =
    publicMetadata && typeof publicMetadata === "object"
      ? (publicMetadata as Record<string, unknown>)
      : {};

  const metadataPlan = meta.plan;
  const rawPlan: Plan = isPlan(metadataPlan)
    ? metadataPlan
    : serializeEntitlement(entitlement).plan;

  const effectivePlan = resolveEffectivePlan({
    plan: rawPlan,
    isSignedIn: true,
    userCreatedAtMs,
  });

  return canReadWholeBook({
    plan: effectivePlan,
    ownedBooks: getOwnedBooks(meta),
    bookSlug,
  });
}

function isPlan(value: unknown): value is Exclude<Plan, undefined> {
  return (
    value === "free" ||
    value === "basic" ||
    value === "premium" ||
    value === "polyglot" ||
    value === "owner"
  );
}
