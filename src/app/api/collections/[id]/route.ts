import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/collections/:id; rename. Body: { name: string } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const { name } = (body ?? {}) as { name?: string };
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const existing = await prisma.favoriteCollection.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const updated = await prisma.favoriteCollection.update({
    where: { id },
    data: { name: name.trim().slice(0, 80) },
  });
  return NextResponse.json({ collection: updated });
}

/** DELETE /api/collections/:id; delete the whole collection. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.favoriteCollection.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await prisma.favoriteCollection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
