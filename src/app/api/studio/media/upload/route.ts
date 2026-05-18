/**
 * Studio API: generic media upload to R2 (cover / audio / misc).
 *
 *   POST  multipart/form-data
 *     file: <Blob>     (required)
 *     kind: "cover" | "audio" | "misc"  (required)
 *
 * Validates MIME + size, uploads to R2 via `uploadPublicObject`, returns
 * `{ url, key, filename, size, contentType }`. Files are content-hashed so
 * re-uploading the same bytes returns the same URL (cheap dedupe).
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject, getPublicObjectUrl } from "@/lib/objectStorage";

export const runtime = "nodejs";
// Audio uploads can be a few MB; allow plenty of headroom under the Vercel
// timeout. The /api/studio/audio/cloned-voices endpoint uses similar bounds.
export const maxDuration = 60;

type Kind = "cover" | "audio" | "misc";

// Generous, opinionated MIME allowlists. Anything outside these returns 415.
const ALLOWED: Record<Kind, { mimes: string[]; exts: string[]; maxBytes: number; prefix: string }> = {
  cover: {
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    exts: ["jpg", "jpeg", "png", "webp", "gif"],
    // 10 MB — covers should be optimized, this is the upper guard.
    maxBytes: 10 * 1024 * 1024,
    prefix: "media/uploads/covers",
  },
  audio: {
    mimes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/m4a", "audio/mp4", "audio/aac", "audio/webm"],
    exts: ["mp3", "wav", "ogg", "m4a", "aac", "webm"],
    // 25 MB — covers full-length story narration even at 192 kbps.
    maxBytes: 25 * 1024 * 1024,
    prefix: "media/uploads/audio",
  },
  misc: {
    mimes: ["application/octet-stream", "text/plain", "application/json", "image/jpeg", "image/png"],
    exts: ["bin", "txt", "json", "jpg", "png"],
    maxBytes: 8 * 1024 * 1024,
    prefix: "media/uploads/misc",
  },
};

function extFromMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    case "audio/mpeg":
    case "audio/mp3": return "mp3";
    case "audio/wav":
    case "audio/x-wav": return "wav";
    case "audio/ogg": return "ogg";
    case "audio/m4a":
    case "audio/mp4": return "m4a";
    case "audio/aac": return "aac";
    case "audio/webm": return "webm";
    default: return null;
  }
}

function extFromFilename(name: string): string | null {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return null;
  const ext = name.slice(idx + 1).toLowerCase();
  return ext.length > 0 && ext.length <= 6 ? ext : null;
}

async function gate(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = await gate();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido (esperaba multipart/form-data)." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || (file as File).size === 0) {
    return NextResponse.json({ error: "Falta el campo `file`." }, { status: 400 });
  }
  const kindRaw = (form.get("kind") as string | null) ?? "misc";
  const kind = (Object.keys(ALLOWED) as Kind[]).includes(kindRaw as Kind) ? (kindRaw as Kind) : "misc";
  const rules = ALLOWED[kind];

  const contentType = (file.type || "application/octet-stream").toLowerCase();
  const originalName = "name" in file && typeof (file as File).name === "string" ? (file as File).name : "upload";

  if (!rules.mimes.includes(contentType)) {
    // Some browsers send empty type for audio — accept by extension as a fallback.
    const ext = extFromFilename(originalName);
    if (!ext || !rules.exts.includes(ext)) {
      return NextResponse.json(
        { error: `Tipo no permitido para kind=${kind}: ${contentType || "(sin tipo)"}`, code: "UNSUPPORTED_TYPE" },
        { status: 415 }
      );
    }
  }

  if (file.size > rules.maxBytes) {
    return NextResponse.json(
      {
        error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo ${rules.maxBytes / 1024 / 1024} MB para kind=${kind}.`,
        code: "TOO_LARGE",
      },
      { status: 413 }
    );
  }

  const body = Buffer.from(await file.arrayBuffer());

  // Content-hash the bytes so repeated uploads of the same file land on the
  // same key (cheap dedupe + immutable cache headers play nice).
  const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 24);
  const ext = extFromMime(contentType) ?? extFromFilename(originalName) ?? "bin";
  const key = `${rules.prefix}/${hash}.${ext}`;

  // Short-circuit: if R2 already has this object, skip the PUT.
  const existing = getPublicObjectUrl(key);
  if (existing) {
    try {
      const head = await fetch(existing, { method: "HEAD" });
      if (head.ok) {
        return NextResponse.json({
          url: existing,
          key,
          filename: originalName,
          size: file.size,
          contentType,
          cached: true,
        });
      }
    } catch {
      // Fall through to fresh upload.
    }
  }

  let result;
  try {
    result = await uploadPublicObject({ key, body, contentType });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload a R2 falló.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
  if (!result) {
    return NextResponse.json(
      { error: "MEDIA_STORAGE no configurado (revisa MEDIA_STORAGE_* env vars)." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    url: result.url,
    key: result.key,
    filename: originalName,
    size: file.size,
    contentType,
    cached: false,
  });
}
