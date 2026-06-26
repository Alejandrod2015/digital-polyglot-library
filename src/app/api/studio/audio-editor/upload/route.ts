import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { spliceFragmentIntoMaster } from "@/lib/audioEditorSplice";
import { replaceSectionAndRebuild } from "@/lib/audioEditorSections";

export const maxDuration = 120;

/**
 * POST /api/studio/audio-editor/upload   (multipart/form-data)
 *   fields: storyId, startSec, endSec, audio (File: mp3 fragment)
 *
 * Manual per-FRAGMENT audio replacement. The operator records/renders the
 * corrected audio for a single tramo and uploads it; we splice it into the
 * master at [startSec, endSec] with crossfades (local ffmpeg, or Modal on
 * Vercel) and store the result as `audioUrlPreview` (master stays intact
 * until "Guardar" → /promote swaps it in and re-runs aeneas alignment).
 *
 * No segment processing; the operator's file is treated as final.
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
  const startSec = Number(form.get("startSec"));
  const endSec = Number(form.get("endSec"));
  const fragIdxRaw = form.get("fragmentIndex");
  const sectionMode = typeof fragIdxRaw === "string" && fragIdxRaw !== "" && Number.isInteger(Number(fragIdxRaw));
  const fragmentIndex = sectionMode ? Number(fragIdxRaw) : -1;

  if (typeof storyId !== "string" || !storyId) {
    return NextResponse.json({ error: "storyId requerido" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube un archivo de audio en el campo 'audio'" }, { status: 400 });
  }
  if (!sectionMode && (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec)) {
    return NextResponse.json({ error: "startSec/endSec inválidos (endSec debe ser mayor que startSec)" }, { status: 400 });
  }

  const name = (file.name || "").toLowerCase();
  const isMp3 = name.endsWith(".mp3") || file.type === "audio/mpeg" || file.type === "audio/mp3";
  if (!isMp3) {
    return NextResponse.json({ error: "El fragmento debe ser un MP3 (.mp3)" }, { status: 400 });
  }
  if (file.size < 1024) {
    return NextResponse.json({ error: "El fragmento parece vacío o corrupto" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "El fragmento es demasiado grande (máx 25 MB)" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, audioUrl: true, audioFilename: true },
  });
  if (!story) return NextResponse.json({ error: "Historia no encontrada" }, { status: 404 });
  if (!story.audioUrl) {
    return NextResponse.json({ error: "La historia no tiene audio maestro todavía" }, { status: 400 });
  }

  const fragment = Buffer.from(await file.arrayBuffer());

  // SECTION MODE: the uploaded mp3 IS the new section; swap it and
  // rebuild the master (exact, no time-splice). Writes directly.
  if (sectionMode) {
    try {
      const r = await replaceSectionAndRebuild({ storyId, fragmentIndex, newSectionBuffer: fragment });
      return NextResponse.json({
        ok: true,
        sectionReplaced: true,
        audioUrl: r.audioUrl,
        sectionUrl: r.sectionUrl,
        prevSectionUrl: r.prevSectionUrl,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error reemplazando la sección" }, { status: 502 });
    }
  }

  const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
    .replace(/\.mp3$/, "")
    .replace(/_edit\d+$/, "")
    .replace(/_upload\d+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const newFilename = `${baseName}_upload${Date.now()}.mp3`;

  let result: { url: string; filename: string };
  try {
    result = await spliceFragmentIntoMaster({
      masterUrl: story.audioUrl,
      fragment,
      startSec,
      endSec,
      filename: newFilename,
      process: null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error empalmando el fragmento" },
      { status: 502 },
    );
  }

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioUrlPreview: result.url, audioFilenamePreview: result.filename },
  });

  return NextResponse.json({ ok: true, audioUrlPreview: result.url, audioFilenamePreview: result.filename });
}
