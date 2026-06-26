import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Same shape as `collectionWordKey()` on iPhone:
 *  `${language}::${word}` lowercased. Empty language tolerated. */
function makeWordKey(word: string, language?: string | null): string {
  const w = (word ?? "").trim().toLowerCase();
  const l = (language ?? "").trim().toLowerCase();
  return `${l}::${w}`;
}

/** POST /api/collections/:id/items; add a word.
 *  Body: { word: string, language?: string } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const { word, language } = (body ?? {}) as { word?: string; language?: string };
  if (typeof word !== "string" || word.trim().length === 0) {
    return NextResponse.json({ error: "word_required" }, { status: 400 });
  }

  const existing = await prisma.favoriteCollection.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const key = makeWordKey(word, language);
  if (existing.wordKeys.includes(key)) {
    return NextResponse.json({ collection: existing, added: false });
  }
  const updated = await prisma.favoriteCollection.update({
    where: { id },
    data: { wordKeys: { push: key } },
  });
  return NextResponse.json({ collection: updated, added: true });
}

/** DELETE /api/collections/:id/items?key=...; remove a word. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });

  const existing = await prisma.favoriteCollection.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const updated = await prisma.favoriteCollection.update({
    where: { id },
    data: { wordKeys: existing.wordKeys.filter((k) => k !== key) },
  });
  return NextResponse.json({ collection: updated });
}
