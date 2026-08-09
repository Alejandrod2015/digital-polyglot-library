import { NextResponse } from "next/server";

import { buildJourneyVariants } from "@/app/journey/journeyData";

// Catalog of every published journey across ALL languages, in the compact
// shape the "+ Add journey" picker needs (no story ladders). Powers the
// inline language → journey picker in the reader's language sheet, mirroring
// the mobile JourneysPanel. Fetched lazily when the user opens the picker.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tracks = await buildJourneyVariants(undefined);
    const options = tracks.map((t) => ({
      slug: t.slug,
      label: t.label,
      language: t.language,
      variant: t.variant,
    }));
    return NextResponse.json({ options });
  } catch (err) {
    console.error("[journeys/catalog] failed", err);
    return NextResponse.json({ options: [] }, { status: 500 });
  }
}
