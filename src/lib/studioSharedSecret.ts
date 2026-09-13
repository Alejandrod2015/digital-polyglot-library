import { timingSafeEqual } from "crypto";

// Cabecera propia para llamar a rutas de Studio sin sesión, desde scripts.
//
// POR QUÉ NO `Authorization: Bearer` (2026-09-13):
//   clerkMiddleware lee la cabecera Authorization como si fuera SU token de
//   sesión. Un secreto compartido no tiene forma de JWT, así que Clerk responde
//   con `x-clerk-auth-message: Invalid JWT form`, marca la petición como
//   signed-out, y en producción la ruta acababa devolviendo 401 aunque el
//   secreto coincidiera con el de Vercel. Una cabecera que Clerk no mira evita
//   el choque sin tocar el middleware ni abrir la ruta: sin el secreto exacto,
//   se sigue exigiendo la sesión de Studio.
export const STUDIO_SECRET_HEADER = "x-dpl-cron-secret";

function sameSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// true solo si la petición trae CRON_SECRET exacto, en la cabecera propia o, por
// compatibilidad con los scripts viejos, como `Authorization: Bearer`. Sin
// CRON_SECRET en el entorno, nunca.
export function hasStudioSharedSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  const custom = request.headers.get(STUDIO_SECRET_HEADER)?.trim();
  if (custom && sameSecret(custom, expected)) return true;

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.startsWith("Bearer ")) {
    return sameSecret(authorization.slice("Bearer ".length).trim(), expected);
  }
  return false;
}
