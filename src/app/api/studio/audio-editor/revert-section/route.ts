import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isStudioMember } from "@/lib/studio-access";
import { revertSection } from "@/lib/audioEditorSections";

export const maxDuration = 120;

/**
 * POST /api/studio/audio-editor/revert-section   { storyId, fragmentIndex }
 *
 * Revert one section to its previous take (swaps url↔prevUrl) and
 * rebuilds the master. Toggleable — calling it again restores the other
 * version. No ElevenLabs cost (reuses already-uploaded section files).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; fragmentIndex?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.storyId || typeof body.fragmentIndex !== "number") {
    return NextResponse.json({ error: "storyId y fragmentIndex requeridos" }, { status: 400 });
  }

  try {
    const r = await revertSection({ storyId: body.storyId, fragmentIndex: body.fragmentIndex });
    return NextResponse.json({ ok: true, audioUrl: r.audioUrl, sectionUrl: r.sectionUrl, prevSectionUrl: r.prevSectionUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al revertir la sección" }, { status: 502 });
  }
}
