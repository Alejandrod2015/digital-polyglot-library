import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/studio/validar/stories
 *
 * Devuelve las historias actuales del pipeline agrupadas por journey,
 * nivel y tema. Reemplaza el "historial de validaciones" del UI: lo que
 * importa no es cada intento de validación sino qué historias quedaron
 * efectivamente subidas y en qué etapa están.
 *
 * Se filtra a journeys no archivados y se ordena: journey reciente →
 * nivel asc → tema asc → slotIndex asc. La pantalla cliente sólo tiene
 * que iterar el array para renderizar.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stories = await prisma.journeyStory.findMany({
    where: { journey: { status: { not: "archived" } } },
    orderBy: [
      { journey: { createdAt: "desc" } },
      { level: "asc" },
      { topic: "asc" },
      { slotIndex: "asc" },
    ],
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      topic: true,
      slotIndex: true,
      status: true,
      coverDone: true,
      coverUrl: true,
      audioUrl: true,
      audioStatus: true,
      journeyId: true,
      arcType: true,
      journey: {
        select: {
          id: true,
          name: true,
          language: true,
          variant: true,
        },
      },
    },
  });

  return NextResponse.json({ stories });
}
