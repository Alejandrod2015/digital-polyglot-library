// Un pulgar arriba o abajo al final de una historia, con comentario opcional.
//
// El endpoint se llama DOS veces para la misma fila y a propósito: primero en
// el toque del pulgar (sin comentario), y otra vez solo si la persona escribe
// algo. Ese orden es la feature entera: el dato que queremos ya está a salvo
// antes de que aparezca el teclado, así que cerrar el panel sin escribir no
// pierde nada. De ahí el upsert sobre (userId, storySlug) en vez de un create.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveMobileSession } from "@/lib/mobileSession";

const COMMENT_MAX = 2000;

// Techo por usuario. Un lector normal no lo roza ni leyendo todo el día; un
// bucle de reintentos atascado no llena la tabla.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const userHits = new Map<string, number[]>();

function rateLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (userHits.get(userId) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    userHits.set(userId, arr);
    return false;
  }
  arr.push(now);
  userHits.set(userId, arr);
  return true;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

type Body = {
  storyId?: unknown;
  storySlug?: unknown;
  bookSlug?: unknown;
  liked?: unknown;
  comment?: unknown;
  platform?: unknown;
  appVersion?: unknown;
  buildNumber?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(session.sub)) {
    return NextResponse.json({ error: "Too many ratings. Try again later." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const storySlug = str(body.storySlug, 200);
  const storyId = str(body.storyId, 200) ?? storySlug;
  if (!storySlug || !storyId) {
    return NextResponse.json({ error: "storySlug is required" }, { status: 400 });
  }

  if (typeof body.liked !== "boolean") {
    return NextResponse.json({ error: "liked must be a boolean" }, { status: 400 });
  }

  const comment = str(body.comment, COMMENT_MAX);
  const platform = str(body.platform, 20)?.toLowerCase();
  const shared = {
    storyId,
    bookSlug: str(body.bookSlug, 200),
    liked: body.liked,
    platform: platform === "android" ? "android" : platform === "ios" ? "ios" : null,
    appVersion: str(body.appVersion, 40),
    buildNumber: str(body.buildNumber, 40),
    email: session.email?.trim().toLowerCase() ?? null,
  };

  // Se mira antes de escribir para saber QUÉ ha pasado de verdad: nace el voto,
  // cambia de opinión, o llega el comentario después. El upsert por sí solo no
  // lo distingue, y sin esa distinción las métricas contarían dos veces el
  // mismo pulgar (el voto y su comentario viajan en dos POST).
  const previous = await prisma.storyRating.findUnique({
    where: { userId_storySlug: { userId: session.sub, storySlug } },
    select: { id: true, liked: true, comment: true },
  });

  const rating = await prisma.storyRating.upsert({
    where: { userId_storySlug: { userId: session.sub, storySlug } },
    create: { userId: session.sub, storySlug, comment, ...shared },
    // Un segundo POST sin comentario es el propio voto reenviado (por ejemplo
    // tras un reintento de red), no un borrado: solo se pisa el comentario
    // cuando el cuerpo trae uno.
    update: { ...shared, ...(comment ? { comment } : {}) },
  });

  // Además de su tabla, el voto entra en métricas, que es donde vive todo lo
  // demás que hace un lector (`audio_complete`, `vocab_clicked`). Así la señal
  // se puede cruzar con el resto de la sesión sin inventar otro almacén.
  const metricEvents: Array<{ eventType: string; value: number }> = [];
  const votedNow = !previous || previous.liked !== body.liked;
  if (votedNow) {
    metricEvents.push({ eventType: "story_rated", value: body.liked ? 1 : 0 });
  }
  if (comment && comment !== previous?.comment) {
    metricEvents.push({ eventType: "story_rating_comment", value: comment.length });
  }

  if (metricEvents.length > 0) {
    await prisma.userMetric
      .createMany({
        data: metricEvents.map((event) => ({
          userId: session.sub,
          storySlug,
          bookSlug: shared.bookSlug,
          eventType: event.eventType,
          value: event.value,
          metadata: {
            liked: body.liked,
            hasComment: Boolean(comment ?? previous?.comment),
            changedMind: Boolean(previous && previous.liked !== body.liked),
          },
        })),
      })
      // Perder una fila de métricas nunca puede costar el voto, que ya está
      // escrito en su tabla y es el dato que importa.
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, id: rating.id }, { status: 201 });
}
