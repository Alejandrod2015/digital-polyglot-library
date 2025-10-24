// /src/app/api/cron/update-story-of-the-week/route.ts
import { NextResponse } from "next/server";
import { updateFeaturedStory } from "@/sanity/actions/updateFeaturedStory";

export async function GET() {
  try {
    await updateFeaturedStory("UTC", "week"); // Cambia a "day" si quieres la historia diaria
    return NextResponse.json({ ok: true, message: "Story of the Week updated." });
  } catch (err) {
    console.error("💥 Error en cron:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
