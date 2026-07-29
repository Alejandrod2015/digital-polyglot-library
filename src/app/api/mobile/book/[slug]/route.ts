export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { getCatalogBooksBySlugs } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

// Serves a full catalog book (with its stories) to the app.
//
// WHY (2026-07-29): the app can only open a book it finds in the catalog it
// bundles at build time, so a title published after the last App Store build
// was unopenable even when the buyer owned it. My Library now renders those
// rows from server-resolved metadata; this route is how the app actually
// opens them.
//
// Access is gated on ownership: the caller must have the LibraryBook row.
// This route exists to open what you bought, not to browse the catalog.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing book slug" }, { status: 400 });
  }

  const owned = await prisma.libraryBook.findFirst({
    where: { userId: session.sub, bookId: slug },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  const [book] = await getCatalogBooksBySlugs([slug]);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ book });
}
