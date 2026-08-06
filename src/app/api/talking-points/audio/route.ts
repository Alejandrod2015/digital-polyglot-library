import { NextResponse } from "next/server";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { getPiece } from "@/lib/talkingPoints";

// Renders the narration for one Talking Points piece.
//
// WHY a route and not a script: `@/lib/elevenlabs` pulls in `server-only`, so
// it cannot be imported from tsx. The alternative was to re-implement the
// pipeline in a script, and that pipeline is where the narration standard
// lives — the approved-voice assertion, the loudness normalisation and the STT
// quality check. A second copy would drift from it. So the render happens
// inside Next, calling the exact function the Studio calls for a single-voice
// story.
//
// GUARDS. Rendering a whole piece costs credits, so this is deliberately hard
// to trigger by accident:
//   - development only; it returns 404 in production, like it did not exist.
//   - the request must carry `confirm: "render-audio"`. No stray fetch or
//     prefetch can spend anything.
// It writes to no database. It returns the URL; a human pastes it in.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    confirm?: string;
  };

  if (body.confirm !== "render-audio") {
    return NextResponse.json(
      { error: 'Falta confirm: "render-audio". Un render completo cuesta creditos.' },
      { status: 400 }
    );
  }

  const found = body.slug ? getPiece(body.slug) : undefined;
  if (!found) {
    return NextResponse.json({ error: `Pieza "${body.slug}" no encontrada` }, { status: 404 });
  }

  const { topic, piece } = found;
  if (piece.body.length === 0) {
    return NextResponse.json({ error: "La pieza no tiene texto" }, { status: 400 });
  }

  console.log(`[tp-audio] Renderizando "${piece.title}" (${topic.language})`);

  const result = await generateAndUploadAudio(
    piece.body.join("\n\n"),
    piece.title,
    topic.language,
    topic.country === "DE" ? "germany" : topic.country.toLowerCase()
  );

  if (!result) {
    return NextResponse.json({ error: "La generacion devolvio null" }, { status: 500 });
  }

  return NextResponse.json({
    slug: piece.slug,
    voiceId: result.voiceId,
    url: result.url,
    segments: result.audioSegments.length,
    audioQa: result.audioQa,
  });
}
