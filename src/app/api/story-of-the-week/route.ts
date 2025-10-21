// /src/app/api/story-of-the-week/route.ts
import { NextResponse } from "next/server";
import { updateStoryOfTheWeek } from "@/sanity/actions/updateStoryOfTheWeek";
import { getFeaturedStory } from "@/lib/getFeaturedStory";
import { client } from "@/sanity/lib/client";

/**
 * API endpoint: obtiene o actualiza la Story of the Week
 * Puede llamarse desde el frontend o como Cron Job.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") || "UTC";

    // 🔁 Actualiza si corresponde (solo si no hay historia o si es Cron)
    await updateStoryOfTheWeek(tz, "week");

    // 🧩 Obtiene la historia destacada actual
    const featured = await getFeaturedStory("week", tz);
    if (!featured?.slug) {
      return NextResponse.json({ ok: false, message: "No featured story found." }, { status: 404 });
    }

    // 📖 Datos completos de la historia
    const story = await client.fetch(
      `*[_type == "story" && slug.current == $slug][0]{
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
      { slug: featured.slug }
    );

    if (!story) {
      return NextResponse.json({ ok: false, message: "Story not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, featured, story });
  } catch (err) {
    console.error("💥 Error in /api/story-of-the-week:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
