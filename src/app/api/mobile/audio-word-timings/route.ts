// Mobile-side companion to the studio word-timings pipeline. Returns
// the AudioWordTimingsPayload for a given story slug, looking it up in
// two places:
//   1. `JourneyStory.audioWordTimings` (curriculum stories).
//   2. `CatalogStoryAudioTimings` (static catalog stories, populated by
//      `scripts/generateCatalogAudioTimings.ts`).
// `{ timings: null }` when neither has an alignment. Safe to call for
// every story; the mobile reader opts into highlighted render only when
// the payload is non-null.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getActiveMobileSession } from "@/lib/mobileSession";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { checkKaraokeUsable } from "@/lib/karaokeQualityGate";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }
  // Opcional: las versiones de la app que aún no lo mandan siguen funcionando
  // por slug (ver el fallback más abajo).
  const bookSlug = req.nextUrl.searchParams.get("bookSlug")?.trim() || null;

  try {
    const journeyRow = await prisma.journeyStory.findFirst({
      where: { slug, status: "published" },
      select: { audioWordTimings: true },
    });

    // Mismo portón de calidad que la web: si el texto guardado no
    // corresponde al audio, la app recibe `null` y muestra el lector limpio
    // en vez de un resaltado seguro de sí mismo pero equivocado.
    const journeyTimings = coerceAudioWordTimings(journeyRow?.audioWordTimings ?? null);
    if (journeyTimings) {
      const gate = checkKaraokeUsable(slug, journeyTimings);
      return NextResponse.json({ timings: gate.usable ? journeyTimings : null });
    }

    // El slug no identifica una historia del catálogo: se repite entre libros
    // (`el-vendedor-ambulante` está en el argentino y en el colombiano), y
    // buscar sólo por slug le servía a una el karaoke de la otra. La app manda
    // `bookSlug` desde la versión de hoy; para las builds ya instaladas queda
    // el fallback por slug, limitado a los slugs que NO están en colisión:
    // quedarse sin karaoke es mejor que resaltar el texto equivocado.
    const catalogRow = bookSlug
      ? await prisma.catalogStoryAudioTimings.findFirst({
          where: { story: { slug, book: { slug: bookSlug } } },
          select: { audioWordTimings: true },
        })
      : null;
    const catalogFallbackRow = catalogRow
      ? null
      : await (async () => {
          const conEseSlug = await prisma.catalogStory.count({ where: { slug } });
          if (conEseSlug > 1) return null;
          return prisma.catalogStoryAudioTimings.findFirst({
            where: { slug },
            select: { audioWordTimings: true },
          });
        })();
    const catalogTimings = coerceAudioWordTimings(
      catalogRow?.audioWordTimings ?? catalogFallbackRow?.audioWordTimings ?? null
    );
    const catalogGate = checkKaraokeUsable(slug, catalogTimings);
    return NextResponse.json({ timings: catalogGate.usable ? catalogTimings : null });
  } catch (error) {
    console.error("[mobile/audio-word-timings] failed", error);
    return NextResponse.json({ timings: null });
  }
}
