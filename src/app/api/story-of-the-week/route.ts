// /src/app/api/story-of-the-week/route.ts
import { NextResponse } from "next/server";
import { getFeaturedStory, getFeaturedStoryDataBySlug } from "@/lib/getFeaturedStory";

/**
 * API endpoint: obtiene Story of the Week desde contenido estático exportado.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get("tz") || "UTC";

    const featured = await getFeaturedStory("week", tz);
    if (!featured?.slug) {
      return NextResponse.json({ ok: false, message: "No featured story found." }, { status: 404 });
    }

    const story = getFeaturedStoryDataBySlug(featured.slug);
    if (!story) {
      return NextResponse.json({ ok: false, message: "Story not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, featured, story });
  } catch (err) {
    console.error("💥 Error in /api/story-of-the-week:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
