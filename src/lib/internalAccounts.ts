// Quien de dentro de casa aparece en los datos de fuera.
//
// Alejandro y sus dos managers usan la app como cualquier lector: leen,
// puntuan y dejan comentarios. Esos actos son indistinguibles de los de un
// tester salvo por el correo, asi que cualquier recuento de senal externa
// tiene que restarlos primero. El 2026-08-21 los seis unicos pulgares del
// programa eran suyos, y se reportaron como si fueran de testers.
//
// La lista sale de StudioMember, que ya es la fuente de verdad de quien
// trabaja aqui: asi dar de alta a alguien en el Studio lo excluye de las
// metricas el mismo dia, sin tocar codigo.

import { prisma } from "@/lib/prisma";

const TTL_MS = 60_000;

let cache: Set<string> | null = null;
let cachedAt = 0;

/** Correos del equipo, en minusculas. Cacheado 60s, como studio-access. */
export async function listInternalEmails(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;

  try {
    const rows = await prisma.studioMember.findMany({ select: { email: true } });
    cache = new Set(rows.map((r) => r.email.trim().toLowerCase()));
    cachedAt = now;
  } catch {
    // Una consulta fallida no debe convertir a todo el equipo en externo: es
    // preferible servir la lista anterior, y si no hay ninguna, avisar arriba
    // devolviendo un conjunto vacio es peor que fallar. Se propaga el error.
    if (!cache) throw new Error("No se pudo leer StudioMember para excluir internos");
  }

  return cache;
}

export function invalidateInternalAccountsCache(): void {
  cache = null;
  cachedAt = 0;
}

/** True si el correo pertenece al equipo. Un correo vacio NO es interno. */
export async function isInternalEmail(email: string | null | undefined): Promise<boolean> {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  return (await listInternalEmails()).has(e);
}

/**
 * Parte una lista en externos e internos en vez de tirar los internos.
 * Contarlos por separado es lo que permite decir "6 pulgares, todos de casa"
 * en vez de "0 pulgares", que se lee como que la funcion no se usa.
 */
export async function splitInternal<T>(
  rows: T[],
  emailOf: (row: T) => string | null | undefined,
): Promise<{ external: T[]; internal: T[] }> {
  const internos = await listInternalEmails();
  const external: T[] = [];
  const internal: T[] = [];
  for (const row of rows) {
    const e = emailOf(row)?.trim().toLowerCase();
    (e && internos.has(e) ? internal : external).push(row);
  }
  return { external, internal };
}
