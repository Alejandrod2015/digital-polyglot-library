// /src/app/api/story-of-the-day/route.ts
import { NextResponse } from "next/server";
import { updateStoryOfTheWeek } from "@/sanity/actions/updateStoryOfTheWeek";
import { getFeaturedStory } from "@/lib/getFeaturedStory";
import { client } from "@/sanity/lib/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") || "UTC";

    // Actualiza/asegura la historia del día
    await updateStoryOfTheWeek(tz, "day");

    // Obtiene la historia destacada del día
    const featured = await getFeaturedStory("day", tz);
    if (!featured?.slug) {
      return NextResponse.json({ ok: false, message: "No featured story for today." }, { status: 404 });
    }

    // Datos completos para el front
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
    console.error("💥 Error in /api/story-of-the-day:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
