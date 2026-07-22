/**
 * Studio API: subir una portada manualmente para una JourneyStory.
 *
 *   POST /api/studio/journeys/cover-upload
 *
 * Multipart body con `storyId` (campo de texto) + `file` (la imagen).
 * Acepta png/jpg/webp hasta 8 MB. Sube a R2 y escribe `coverUrl` +
 * `coverDone=true` en la historia. Misma persistencia que la selección
 * de variante generada (cover-variants `selectVariantUrl`).
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject, isObjectStorageConfigured } from "@/lib/objectStorage";
import { computeCoverThumbhash } from "@/lib/coverThumbhash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function extFromType(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
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

  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: "Object storage not configured" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const storyId = typeof form?.get("storyId") === "string" ? (form!.get("storyId") as string) : "";
  const file = form?.get("file");
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 8 MB)` },
      { status: 413 },
    );
  }
  const type = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: `Unsupported image type: ${type}` }, { status: 415 });
  }

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `media/covers/uploaded/${storyId}-${Date.now()}.${extFromType(type)}`;
  const uploaded = await uploadPublicObject({ key, body: buffer, contentType: type });
  if (!uploaded) return NextResponse.json({ error: "Upload failed" }, { status: 502 });

  const coverThumbhash = await computeCoverThumbhash(uploaded.url);
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { coverUrl: uploaded.url, coverThumbhash, coverDone: true },
  });

  return NextResponse.json({ coverUrl: uploaded.url });
}
