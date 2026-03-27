import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedStandaloneStories,
  getStandaloneStoriesByIds,
  getStandaloneStoriesBySlugs,
} from "@/lib/standaloneStories";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    const slugsParam = searchParams.get("slugs");

    if (idsParam) {
      const ids = Array.from(new Set(idsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await getStandaloneStoriesByIds(ids);
      return NextResponse.json({ stories });
    }

    if (slugsParam) {
      const slugs = Array.from(new Set(slugsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await getStandaloneStoriesBySlugs(slugs);
      return NextResponse.json({ stories });
    }

    const stories = await getPublishedStandaloneStories();
    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Error fetching standalone stories:", error);
    return NextResponse.json({ error: "Failed to load standalone stories" }, { status: 500 });
  }
}
