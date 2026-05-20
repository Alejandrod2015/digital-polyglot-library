/**
 * Studio API: presigned R2 upload URL.
 *
 *   POST  application/json
 *     {
 *       kind: "audio" | "cover",         // required
 *       contentType: string,             // required (e.g. "audio/mpeg")
 *       size: number,                    // required, bytes
 *       hash: string,                    // required, 24-char hex sha256 of file
 *       filename?: string                // optional, only used in response
 *     }
 *
 * Returns `{ uploadUrl, publicUrl, key, cached }`. The browser PUTs the file
 * bytes to `uploadUrl` directly, bypassing the Vercel 4.5 MB body limit that
 * blocks the legacy `/api/studio/media/upload` endpoint for audiobook files.
 *
 * If R2 already has an object at the dedupe key, `cached: true` is returned
 * and the client can skip the PUT entirely.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { getPresignedPutUrl, getPublicObjectUrl } from "@/lib/objectStorage";

export const runtime = "nodejs";

type Kind = "cover" | "audio";

const ALLOWED: Record<Kind, { mimes: string[]; exts: string[]; maxBytes: number; prefix: string }> = {
  cover: {
    mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    exts: ["jpg", "jpeg", "png", "webp", "gif"],
    maxBytes: 10 * 1024 * 1024,
    prefix: "media/uploads/covers",
  },
  audio: {
    mimes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/m4a",
      "audio/x-m4a",
      "audio/mp4",
      "audio/aac",
      "audio/webm",
    ],
    exts: ["mp3", "wav", "ogg", "m4a", "aac", "webm"],
    // 200 MB: audiobook chapters can be long; R2 doesn't care, Vercel never sees the body.
    maxBytes: 200 * 1024 * 1024,
    prefix: "media/uploads/audio",
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
    case "audio/x-m4a":
    case "audio/mp4": return "m4a";
    case "audio/aac": return "aac";
    case "audio/webm": return "webm";
    default: return null;
  }
}

function extFromFilename(name: string | undefined): string | null {
  if (!name) return null;
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

  let body: { kind?: string; contentType?: string; size?: number; hash?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido (esperaba JSON)." }, { status: 400 });
  }

  const kindRaw = body.kind ?? "";
  if (!(kindRaw === "audio" || kindRaw === "cover")) {
    return NextResponse.json({ error: "Campo `kind` debe ser 'audio' o 'cover'." }, { status: 400 });
  }
  const kind = kindRaw as Kind;
  const rules = ALLOWED[kind];

  const contentType = (body.contentType ?? "").toLowerCase().trim();
  const size = Number(body.size);
  const hash = (body.hash ?? "").toLowerCase().trim();
  const filename = body.filename;

  if (!contentType) {
    return NextResponse.json({ error: "Falta `contentType`." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Falta `size` válido." }, { status: 400 });
  }
  if (!/^[0-9a-f]{8,64}$/.test(hash)) {
    return NextResponse.json({ error: "Falta `hash` (hex sha256)." }, { status: 400 });
  }

  if (!rules.mimes.includes(contentType)) {
    const ext = extFromFilename(filename);
    if (!ext || !rules.exts.includes(ext)) {
      return NextResponse.json(
        { error: `Tipo no permitido para kind=${kind}: ${contentType || "(sin tipo)"}`, code: "UNSUPPORTED_TYPE" },
        { status: 415 }
      );
    }
  }

  if (size > rules.maxBytes) {
    return NextResponse.json(
      {
        error: `Archivo demasiado grande (${(size / 1024 / 1024).toFixed(1)} MB). Máximo ${rules.maxBytes / 1024 / 1024} MB para kind=${kind}.`,
        code: "TOO_LARGE",
      },
      { status: 413 }
    );
  }

  const ext = extFromMime(contentType) ?? extFromFilename(filename) ?? "bin";
  const key = `${rules.prefix}/${hash.slice(0, 24)}.${ext}`;

  // Dedupe: if R2 already has this object, return cached URL and skip signing.
  const publicUrl = getPublicObjectUrl(key);
  if (publicUrl) {
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) {
        return NextResponse.json({
          uploadUrl: null,
          publicUrl,
          key,
          filename,
          size,
          contentType,
          cached: true,
        });
      }
    } catch {
      // Fall through to fresh sign.
    }
  }

  const signed = getPresignedPutUrl({ key, expiresInSeconds: 900 });
  if (!signed) {
    return NextResponse.json(
      { error: "MEDIA_STORAGE no configurado (revisa MEDIA_STORAGE_* env vars)." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    uploadUrl: signed.uploadUrl,
    publicUrl: signed.publicUrl,
    key: signed.key,
    filename,
    size,
    contentType,
    cached: false,
  });
}
