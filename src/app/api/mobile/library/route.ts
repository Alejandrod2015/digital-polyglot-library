export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { loadLibraryRows, type LibraryType } from "@/lib/libraryRows";

// WHY (2026-07-29): this route used to return the raw LibraryBook /
// LibraryStory rows, leaving the app to match them against the catalog it
// bundles at build time — the exact lookup that made a paid book vanish from
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
