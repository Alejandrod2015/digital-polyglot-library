/**
 * El tipo de un journey, comprobado al CREARLO.
 *
 * POR QUÉ (2026-08-18). Los ocho tipos deciden lo que más pesa en un journey:
 * cuántos personajes fijos lleva (1 o 2, nunca más), si el orden de temas es
 * obligado y qué son los siete temas (destinos, fases, hitos, servicios). Eso
 * se decide al planear, y hasta hoy no se guardaba en ninguna parte: se
 * adivinaba por el nombre. Pero el plan dice que el nombre NUNCA es el tipo,
 * porque el nombre es la promesa al comprador; con "Hanseat" (un Expat) y
 * "Village Life in Andalusia" ya no había forma de saberlo.
 *
 * Se comprueba al crear, que es donde la decisión existe, y no al validar una
 * historia: para entonces el reparto y los temas ya están escritos.
 */
import { PrismaClient } from "@/generated/prisma";

/** Lo único que se necesita de un cliente: leer los tipos. Se pide así porque
 *  el `prisma` de la app va extendido y no encaja con `PrismaClient` a secas. */
type LectorDeTipos = { journeyType: { findMany: (a: { select: { slug: true; label: true } }) => Promise<Array<{ slug: string; label: string }>> } };

export class JourneyTypeError extends Error {}

/** Cuántos personajes fijos admite cada tipo, según el plan de journeys. */
export const FIXED_CAST_BY_TYPE: Record<string, number> = {
  traveler: 2, cultural: 2, conversational: 2,
  hospitality: 1, business: 1, health: 1, expat: 1, academic: 1,
};

/** Tipos cuyo orden de temas es OBLIGADO (el resto es libre). */
export const ORDERED_TYPES = new Set(["expat", "academic"]);

export async function assertJourneyType(opts: {
  typeSlug: string | null | undefined;
  name: string;
  prisma?: LectorDeTipos;
}): Promise<string> {
  const prisma: LectorDeTipos = opts.prisma ?? (new PrismaClient() as unknown as LectorDeTipos);
  const slug = (opts.typeSlug ?? "").trim();
  const tipos = (await prisma.journeyType.findMany({ select: { slug: true, label: true } }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (!slug) {
    throw new JourneyTypeError(
      `El journey "${opts.name}" no declara tipo. De él dependen los personajes fijos y ` +
      `la forma de los temas, así que no es opcional.\n` +
      `Tipos: ${tipos.map((t) => `${t.slug} (${t.label})`).join(", ")}`,
    );
  }
  if (!tipos.some((t) => t.slug === slug)) {
    throw new JourneyTypeError(
      `Tipo desconocido "${slug}". Tipos: ${tipos.map((t) => t.slug).join(", ")}`,
    );
  }
  return slug;
}
