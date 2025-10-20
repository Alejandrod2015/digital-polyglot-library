// /src/app/api/cron/update-story-of-the-week/route.ts
import { NextResponse } from "next/server";
import { updateStoryOfTheWeek } from "@/sanity/actions/updateStoryOfTheWeek";

export async function GET() {
  try {
    await updateStoryOfTheWeek("UTC", "week"); // Cambia a "day" si quieres la historia diaria
    return NextResponse.json({ ok: true, message: "Story of the Week updated." });
  } catch (err) {
    console.error("💥 Error en cron:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
