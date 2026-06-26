import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// User-defined favorite collections. Mirrors the iPhone-side type in
// apps/mobile/src/mobile/collections.ts so a future iPhone migration
// can hydrate from this endpoint without shape changes.

export const dynamic = "force-dynamic";

/** GET /api/collections; list the current user's collections. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ collections: [] }, { status: 401 });

  const rows = await prisma.favoriteCollection.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ collections: rows });
}

/** POST /api/collections; create a new collection.
 *  Body: { name: string, language?: string, wordKeys?: string[] } */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { name, language, wordKeys } = (body ?? {}) as {
    name?: string;
    language?: string;
    wordKeys?: string[];
  };
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const created = await prisma.favoriteCollection.create({
    data: {
      userId,
      name: name.trim().slice(0, 80),
      language: typeof language === "string" && language.trim() ? language.trim() : null,
      wordKeys: Array.isArray(wordKeys)
        ? Array.from(new Set(wordKeys.filter((k) => typeof k === "string" && k.length > 0)))
        : [],
    },
  });
  return NextResponse.json({ collection: created });
}
