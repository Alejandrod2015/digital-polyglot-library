export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { getCatalogBooksBySlugs } from "@/lib/catalog";
import { decideMobileBookAccess } from "@/lib/mobileBookAccess";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// Serves a full catalog book (with its stories) to the app.
//
// WHY (2026-07-29): the app can only open a book it finds in the catalog it
// bundles at build time, so a title published after the last App Store build
// was unopenable even when the buyer owned it. My Library now renders those
// rows from server-resolved metadata; this route is how the app actually
// opens them.
//
// Access is gated on what the claim wrote (publicMetadata.books) or on an
// entitled plan, the same rule the web reader applies. It used to trust the
// LibraryBook row, which any mobile session could create for any bookId
// (security audit 2026-09-18, critical finding #2).
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

  const [entitlement, user] = await Promise.all([
    prisma.billingEntitlement.findUnique({ where: { userId: session.sub } }),
    clerkClient.users.getUser(session.sub).catch(() => null),
  ]);

  const allowed = decideMobileBookAccess({
    publicMetadata: user?.publicMetadata ?? {},
    entitlement,
    userCreatedAtMs: typeof user?.createdAt === "number" ? user.createdAt : null,
    bookSlug: slug,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Not in your library" }, { status: 403 });
  }

  const [book] = await getCatalogBooksBySlugs([slug]);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  return NextResponse.json({ book });
}
