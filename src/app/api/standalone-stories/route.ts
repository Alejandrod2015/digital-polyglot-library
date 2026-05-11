import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedStandaloneStories,
  getStandaloneStoriesByIds,
  getStandaloneStoriesBySlugs,
} from "@/lib/standaloneStories";
import { shouldReadStandaloneFromStudio } from "@/lib/featureFlags";

function withSourceHeader(res: NextResponse): NextResponse {
  res.headers.set(
    "X-Catalog-Source",
    shouldReadStandaloneFromStudio() ? "studio" : "sanity"
  );
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    const slugsParam = searchParams.get("slugs");

    if (idsParam) {
      const ids = Array.from(new Set(idsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await getStandaloneStoriesByIds(ids);
      return withSourceHeader(NextResponse.json({ stories }));
    }

    if (slugsParam) {
      const slugs = Array.from(new Set(slugsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await getStandaloneStoriesBySlugs(slugs);
      return withSourceHeader(NextResponse.json({ stories }));
    }

    const stories = await getPublishedStandaloneStories();
    return withSourceHeader(NextResponse.json({ stories }));
  } catch (error) {
    console.error("Error fetching standalone stories:", error);
    return NextResponse.json({ error: "Failed to load standalone stories" }, { status: 500 });
  }
}
