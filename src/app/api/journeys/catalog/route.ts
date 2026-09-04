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
    // `levels` viaja tambien: sin el, el selector pinta cuatro filas que se
    // llaman igual ("Traveler / ES · Spain") y el usuario no puede elegir la
    // suya. Solo el id y el titulo; los temas y las historias no hacen falta
    // aqui y abultan la respuesta.
    const options = tracks.map((t) => ({
      slug: t.slug,
      label: t.label,
      language: t.language,
      variant: t.variant,
      levels: (t.levels ?? []).map((l) => ({ id: l.id, title: l.title })),
    }));
    return NextResponse.json({ options });
  } catch (err) {
    console.error("[journeys/catalog] failed", err);
    return NextResponse.json({ options: [] }, { status: 500 });
  }
}
