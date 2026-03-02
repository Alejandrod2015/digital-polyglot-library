// /src/app/api/cron/update-story-of-the-day/route.ts
import { NextResponse } from "next/server";
import { getFeaturedStory } from "@/lib/getFeaturedStory";

/**
 * Cron no-op: mantiene endpoint pero sin escrituras a Sanity.
 */
export async function GET() {
  try {
    const featured = await getFeaturedStory("day", "UTC");
    return NextResponse.json({ ok: true, mode: "static", featuredSlug: featured?.slug ?? null });
  } catch (err) {
    console.error("💥 Error in daily cron:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
