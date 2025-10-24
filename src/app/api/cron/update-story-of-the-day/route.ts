// /src/app/api/cron/update-story-of-the-day/route.ts
import { NextResponse } from "next/server";
import { updateFeaturedStory } from "@/sanity/actions/updateFeaturedStory";

export async function GET() {
  try {
    await updateFeaturedStory("UTC", "day");
    return NextResponse.json({ ok: true, message: "Story of the Day updated." });
  } catch (err) {
    console.error("💥 Error in daily cron:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
