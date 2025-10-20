// /src/app/api/story-of-the-week/route.ts
import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import { updateStoryOfTheWeek } from "@/sanity/actions/updateStoryOfTheWeek";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") || "UTC";

    // 🔄 Actualiza (o mantiene) la historia semanal
    const current = await updateStoryOfTheWeek(tz, "week");

    if (!current?._id) {
      return NextResponse.json(
        { error: "No se pudo determinar la historia semanal." },
        { status: 404 }
      );
    }

    // 🔍 Obtener historia con su libro asociado
    const story = await client.fetch(
      `*[_type == "story" && _id == $id][0]{
        _id,
        title,
        "slug": slug.current,
        focus,
        book->{
          title,
          "slug": slug.current,
          "cover": coalesce(cover.asset->url, "/covers/default.jpg"),
          description,
          language,
          level,
          topic
        }
      }`,
      { id: current._id }
    );

    if (!story) {
      return NextResponse.json(
        { error: "La historia seleccionada no existe." },
        { status: 404 }
      );
    }

        return NextResponse.json({
      ok: true,
      story,
      period: (current as any).period,
      periodKey: (current as any).periodKey,
    });

  } catch (err) {
    console.error("💥 Error en /api/story-of-the-week:", err);
    return NextResponse.json(
      { error: "Error interno al obtener la historia semanal." },
      { status: 500 }
    );
  }
}
