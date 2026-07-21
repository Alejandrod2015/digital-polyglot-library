import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject } from "@/lib/objectStorage";

export const maxDuration = 120;

/**
 * POST /api/studio/audio-editor/replace-master   (multipart/form-data)
 *   fields: storyId, audio (File: full mp3)
 *
 * FULL-MASTER replacement. The operator downloads the story's master audio,
 * edits the whole file in an external editor (Audacity, etc.), and uploads
 * the corrected FULL mp3 here. Unlike /upload (which splices a single
 * fragment/section), this treats the file as the ENTIRE new narration.
 *
 * Non-destructive: the file is stored as `audioUrlPreview`; the master
 * (`audioUrl`) stays intact until the operator clicks "Guardar" → /promote,
 * which swaps preview → master and re-runs aeneas alignment so the karaoke
 * word-timings match the new audio. The operator's file is used verbatim
 * (no tempo/loudness processing) — they already edited it to taste.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido (se esperaba multipart/form-data)" }, { status: 400 });
  }

  const storyId = form.get("storyId");
  const file = form.get("audio");

  if (typeof storyId !== "string" || !storyId) {
    return NextResponse.json({ error: "storyId requerido" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube un archivo de audio en el campo 'audio'" }, { status: 400 });
  }
  const name = (file.name || "").toLowerCase();
  const isMp3 = name.endsWith(".mp3") || file.type === "audio/mpeg" || file.type === "audio/mp3";
  if (!isMp3) {
    return NextResponse.json({ error: "El audio debe ser un MP3 (.mp3)" }, { status: 400 });
  }
  if (file.size < 4096) {
    return NextResponse.json({ error: "El archivo parece vacío o corrupto" }, { status: 400 });
  }
  if (file.size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo es demasiado grande (máx 40 MB)" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, audioUrl: true, audioFilename: true },
  });
  if (!story) return NextResponse.json({ error: "Historia no encontrada" }, { status: 404 });
  if (!story.audioUrl) {
    // Replacing implies there's a master to replace; brand-new audio should
    // go through the normal generation flow, not this editor path.
    return NextResponse.json({ error: "La historia no tiene audio maestro todavía" }, { status: 400 });
  }

  const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
    .replace(/\.mp3$/, "")
    .replace(/_edit\d+$/, "")
    .replace(/_upload\d+$/, "")
    .replace(/_regen\d+$/, "")
    .replace(/_full\d+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const newFilename = `${baseName}_full${Date.now()}.mp3`;

  let uploaded: { url: string } | null;
  try {
    uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newFilename}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: "audio/mpeg",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error subiendo el audio a R2" },
      { status: 502 },
    );
  }
  if (!uploaded?.url) {
    return NextResponse.json({ error: "Upload R2 falló" }, { status: 500 });
  }

  // Store as preview; the master stays until "Guardar" (/promote) swaps it in
  // and re-runs aeneas alignment for karaoke.
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioUrlPreview: uploaded.url, audioFilenamePreview: newFilename },
  });

  return NextResponse.json({ ok: true, audioUrlPreview: uploaded.url, audioFilenamePreview: newFilename });
}
