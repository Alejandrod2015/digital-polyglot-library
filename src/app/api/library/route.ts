// /src/app/api/library/route.ts (optimizado con cache)

export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loadLibraryRows, type LibraryType } from "@/lib/libraryRows";

// Solo historias. La fila de LibraryBook (un libro comprado) la escribe el
// servidor en el claim, nunca el cliente: aceptar `type: "book"` aqui dejaba
// que cualquier cuenta se diera de alta un libro de pago (auditoria
// 2026-09-18, #2). MyLibraryClient solo usa `type: "book"` en el DELETE.
type LibraryBody = {
  type: "story";
  storyId: string;
  title: string;
  coverUrl: string;
  bookId: string;
};

function isLibraryBody(x: unknown): x is LibraryBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.type === "story" &&
    typeof o.storyId === "string" &&
    typeof o.bookId === "string" &&
    typeof o.title === "string" &&
    typeof o.coverUrl === "string"
  );
}

// ✅ cache por usuario + tipo
const getLibraryCached = unstable_cache(
  async (userId: string, type: LibraryType) => loadLibraryRows(userId, type),
  ["library-by-user"],
  { revalidate: 60, tags: ["library-by-user"] }
);

// 🧠 GET → obtener biblioteca (optimizado)
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") as LibraryType) ?? "book";

  try {
    const data = await getLibraryCached(userId, type);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("❌ Error en GET /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// 💾 POST → agregar libro o historia
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isLibraryBody(json))
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const existing = await prisma.libraryStory.findFirst({
      where: { userId, storyId: json.storyId },
    });
    const story = existing
      ? await prisma.libraryStory.update({
          where: { id: existing.id },
          data: {
            title: json.title,
            coverUrl: json.coverUrl,
            bookId: json.bookId,
          },
        })
      : await prisma.libraryStory.create({
          data: {
            userId,
            storyId: json.storyId,
            title: json.title,
            coverUrl: json.coverUrl,
            bookId: json.bookId,
          },
        });
    revalidateTag("library-by-user");
    return NextResponse.json(story, { status: 201 });
  } catch (err: unknown) {
    console.error("❌ Error en POST /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ❌ DELETE → eliminar libro o historia
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const type = (json as { type?: unknown })?.type;
  try {
    if (type === "story") {
      const storyId = (json as { storyId?: unknown })?.storyId;
      if (typeof storyId !== "string")
        return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
      await prisma.libraryStory.deleteMany({ where: { userId, storyId } });
      revalidateTag("library-by-user");
      return NextResponse.json({ success: true });
    }

    const bookId = (json as { bookId?: unknown })?.bookId;
    if (typeof bookId !== "string")
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    await prisma.libraryBook.deleteMany({ where: { userId, bookId } });
    revalidateTag("library-by-user");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Error en DELETE /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
