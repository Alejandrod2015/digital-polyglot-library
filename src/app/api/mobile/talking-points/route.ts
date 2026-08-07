/**
 * Catálogo de Talking Points para la app móvil.
 *
 * La web importa `@/lib/talkingPoints` directamente porque renderiza en el
 * servidor; la app no tiene ese acceso, así que pide el catálogo por HTTP igual
 * que hace con `tap-glosses`. Mismo patrón, misma sesión móvil.
 *
 * Dos formas:
 *   GET /api/mobile/talking-points            → índice (categorías + piezas)
 *   GET /api/mobile/talking-points?slug=<x>   → una pieza COMPLETA
 *
 * El índice va sin cuerpos ni vocabulario: son ~1.300 líneas de catálogo y la
 * pantalla de navegación solo necesita título, gancho, ángulo y si está escrita.
 * El cuerpo se pide al abrir, que es cuando hace falta.
 *
 * GATE: mismo `canAccessTalkingPoints` que la web, contra el plan de la sesión
 * móvil. No se reimplementa la regla; si mañana cambia, cambia en un sitio.
 */
export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getActiveMobileSession } from "@/lib/mobileSession";
import type { Plan } from "@domain/access";
import {
  canAccessTalkingPoints,
  getEntriesByCategory,
  getPiece,
} from "@/lib/talkingPoints";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = (session.plan ?? "free") as Plan;
  if (!canAccessTalkingPoints(plan)) {
    // 403 y no 404: la app necesita distinguir "no existe" de "no incluido en
    // tu plan" para poder ofrecer la mejora en vez de un error mudo.
    return NextResponse.json(
      { error: "Talking Points is part of the Polyglot plan", code: "PLAN_REQUIRED" },
      { status: 403 }
    );
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim();

  if (slug) {
    const found = getPiece(slug);
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { topic, piece } = found;
    return NextResponse.json({
      topic: {
        slug: topic.slug,
        label: topic.label,
        categoryId: topic.categoryId,
        country: topic.country,
        language: topic.language,
        level: topic.level,
      },
      piece: {
        slug: piece.slug,
        title: piece.title,
        hook: piece.hook,
        angle: piece.angle,
        body: piece.body,
        vocab: piece.vocab,
        sources: piece.sources,
        audioUrl: piece.audioUrl ?? null,
        audioWordTimings: piece.audioWordTimings ?? null,
        photo: piece.photo ?? null,
      },
    });
  }

  // Índice: lo justo para navegar. `written` deja que la app ordene y marque
  // las que todavía no tienen cuerpo, en vez de abrirlas y enseñar un vacío.
  const categories = getEntriesByCategory().map(({ category, entries }) => ({
    id: category.id,
    label: category.label,
    entries: entries.map(({ topic, piece }) => ({
      topicSlug: topic.slug,
      topicLabel: topic.label,
      country: topic.country,
      language: topic.language,
      slug: piece.slug,
      title: piece.title,
      hook: piece.hook,
      angle: piece.angle,
      written: piece.body.length > 0,
      hasAudio: Boolean(piece.audioUrl),
      photoUrl: piece.photo?.url ?? null,
    })),
  }));

  return NextResponse.json({ categories });
}
