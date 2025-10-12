export const runtime = "nodejs"; // fuerza ejecución en servidor Node

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

// Prisma en singleton para evitar múltiples conexiones en desarrollo
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

// Tipado y type guard para validar el cuerpo del request
type FavoriteBody = { word: string; translation: string };
function isFavoriteBody(x: unknown): x is FavoriteBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.word === "string" && typeof o.translation === "string";
}

// 🧠 GET → obtener todos los favoritos del usuario logueado
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

// 💾 POST → agregar o actualizar un favorito
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isFavoriteBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { word, translation } = json;

  try {
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
  } catch (err: unknown) {
    console.error("❌ Error en POST /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ❌ DELETE → eliminar un favorito
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const word = (json as { word?: unknown })?.word;

  if (typeof word !== "string" || word.length === 0) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  try {
    await prisma.favorite.deleteMany({
      where: { userId, word },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Error en DELETE /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
