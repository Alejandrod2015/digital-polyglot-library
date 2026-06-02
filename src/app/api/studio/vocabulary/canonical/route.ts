import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { setCanonicalDefinition } from "@/lib/studioVocabulary";

/**
 * POST /api/studio/vocabulary/canonical
 *
 * Body: { journeyId, lemma, definition }
 *
 * Sets the same definition for every vocab item matching the lemma
 * across all stories in the journey. Used by /studio/vocabulary to
 * resolve conflicting definitions in one click.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { journeyId?: string; lemma?: string; definition?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { journeyId, lemma, definition } = body;
  if (!journeyId || !lemma || !definition) {
    return NextResponse.json(
      { error: "journeyId, lemma, definition required" },
      { status: 400 }
    );
  }

  try {
    const result = await setCanonicalDefinition(journeyId, lemma, definition);
    revalidatePath("/studio/vocabulary");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[studio/vocabulary/canonical] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
