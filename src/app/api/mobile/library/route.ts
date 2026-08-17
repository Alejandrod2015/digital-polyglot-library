export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { loadLibraryRows, type LibraryType } from "@/lib/libraryRows";
import { prisma } from "@/lib/prisma";

// WHY (2026-07-29): this route used to return the raw LibraryBook /
// LibraryStory rows, leaving the app to match them against the catalog it
// bundles at build time; the exact lookup that made a paid book vanish from
// My Library on the web (fixed in 07c898fd). A title published after the last
// App Store build is absent from that bundle, so the purchase was dropped.
// Sharing loadLibraryRows with /api/library means the server resolves the
// metadata against CatalogBook/CatalogStory and ships it in `meta`, so a book
// the app has never heard of still renders with cover, level and title.
// The original row fields are untouched, so already-installed builds keep
// working exactly as before.
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type: LibraryType = searchParams.get("type") === "story" ? "story" : "book";

  return NextResponse.json(await loadLibraryRows(session.sub, type));
}

/**
 * Escritura desde la app (2026-08-12). Hasta ahora esta ruta solo tenía GET: el
 * marcador de la app escribía un fichero local del teléfono y no llegaba nunca a
 * la cuenta, así que cada aparato llevaba su propia lista y la web una tercera.
 * Mismo contrato que `/api/library` (la de la web), cambiando Clerk por la
 * sesión de móvil. `bookId` hace de discriminador, como ya hacía ahí:
 * "polyglot" para historias generadas por el usuario, "standalone" para las
 * sueltas y las de journey, y el id real del libro para las del catálogo.
 */
type MobileLibraryBody =
  | { type: "book"; bookId: string; title: string; coverUrl: string }
  | { type: "story"; storyId: string; bookId: string; title: string; coverUrl: string };

function parseLibraryBody(value: unknown): MobileLibraryBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title : "";
  const coverUrl = typeof body.coverUrl === "string" ? body.coverUrl : "";
  const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
  if (!bookId) return null;

  if (body.type === "story") {
    const storyId = typeof body.storyId === "string" ? body.storyId.trim() : "";
    if (!storyId) return null;
    return { type: "story", storyId, bookId, title, coverUrl };
  }
  if (body.type === "book") {
    return { type: "book", bookId, title, coverUrl };
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseLibraryBody(await req.json().catch(() => null));
  if (!body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    if (body.type === "story") {
      const existing = await prisma.libraryStory.findFirst({
        where: { userId: session.sub, storyId: body.storyId },
      });
      const story = existing
        ? await prisma.libraryStory.update({
            where: { id: existing.id },
            data: { title: body.title, coverUrl: body.coverUrl, bookId: body.bookId },
          })
        : await prisma.libraryStory.create({
            data: {
              userId: session.sub,
              storyId: body.storyId,
              title: body.title,
              coverUrl: body.coverUrl,
              bookId: body.bookId,
            },
          });
      revalidateTag("library-by-user");
      return NextResponse.json(story, { status: 201 });
    }

    const existing = await prisma.libraryBook.findFirst({
      where: { userId: session.sub, bookId: body.bookId },
    });
    const book = existing
      ? await prisma.libraryBook.update({
          where: { id: existing.id },
          data: { title: body.title, coverUrl: body.coverUrl },
        })
      : await prisma.libraryBook.create({
          data: {
            userId: session.sub,
            bookId: body.bookId,
            title: body.title,
            coverUrl: body.coverUrl,
          },
        });
    revalidateTag("library-by-user");
    return NextResponse.json(book, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/mobile/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  const body = (json ?? {}) as Record<string, unknown>;

  try {
    if (body.type === "story") {
      const storyId = typeof body.storyId === "string" ? body.storyId.trim() : "";
      if (!storyId) {
        return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
      }
      await prisma.libraryStory.deleteMany({ where: { userId: session.sub, storyId } });
      revalidateTag("library-by-user");
      return NextResponse.json({ ok: true });
    }

    const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }
    await prisma.libraryBook.deleteMany({ where: { userId: session.sub, bookId } });
    revalidateTag("library-by-user");
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("DELETE /api/mobile/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
