// /src/app/api/favorites/route.ts
export const runtime = "nodejs"; // Fuerza ejecución en servidor Node
export const dynamic = "force-dynamic"; // Evita que Next lo ejecute durante el build

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// 🧩 Lazy-load de Prisma (evita errores en build)
let prisma: import("@prisma/client").PrismaClient;

function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
  }
  return prisma;
}

// 🔍 Tipos
type FavoriteBody = { word: string; translation: string };

function isFavoriteBody(x: unknown): x is FavoriteBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.word === "string" && typeof o.translation === "string";
}

// 🧠 GET → Obtener todos los favoritos del usuario logueado
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const favorites = await getPrisma().favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(favorites);
}

// 💾 POST → Agregar o actualizar un favorito
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isFavoriteBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { word, translation } = json;
  const db = getPrisma();

  const existing = await db.favorite.findFirst({
    where: { userId, word },
    select: { id: true },
  });

  const favorite = existing
    ? await db.favorite.update({
        where: { id: existing.id },
        data: { translation },
      })
    : await db.favorite.create({
        data: { userId, word, translation },
      });

  return NextResponse.json(favorite, { status: 201 });
}

// ❌ DELETE → Eliminar un favorito del usuario
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const word = (json as { word?: unknown })?.word;

  if (typeof word !== "string" || word.length === 0) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  await getPrisma().favorite.deleteMany({
    where: { userId, word },
  });

  return NextResponse.json({ success: true });
}
