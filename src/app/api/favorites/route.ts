export const runtime = "nodejs"; // fuerza ejecución en servidor Node

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

// Prisma en singleton para evitar múltiples conexiones en dev
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

type FavoriteBody = { word: string; translation: string };
function isFavoriteBody(x: unknown): x is FavoriteBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.word === "string" && typeof o.translation === "string";
}

// GET → obtener favoritos del usuario logueado
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

// POST → agregar o actualizar un favorito (sin depender de userId_word en el tipo)
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isFavoriteBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const { word, translation } = json;

  const existing = await prisma.favorite.findFirst({
    where: { userId, word },
    select: { id: true },
  });

  const favorite = existing
    ? await prisma.favorite.update({
        where: { id: existing.id },
        data: { translation },
      })
    : await prisma.favorite.create({
        data: { userId, word, translation },
      });

  return NextResponse.json(favorite, { status: 201 });
}

// DELETE → eliminar un favorito
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const word = (json as { word?: unknown })?.word;
  if (typeof word !== "string" || word.length === 0) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  await prisma.favorite.deleteMany({
    where: { userId, word },
  });

  return NextResponse.json({ success: true });
}
