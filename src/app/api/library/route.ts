export const runtime = "nodejs"; // fuerza ejecución en servidor Node

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

// Prisma singleton para evitar múltiples conexiones
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

// Tipado y type guard
type LibraryBody = { bookId: string; title: string; coverUrl: string };
function isLibraryBody(x: unknown): x is LibraryBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.bookId === "string" &&
    typeof o.title === "string" &&
    typeof o.coverUrl === "string"
  );
}

// 🧠 GET → obtener todos los libros guardados del usuario
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const books = await prisma.libraryBook.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(books);
}

// 💾 POST → agregar o actualizar un libro en la biblioteca
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isLibraryBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { bookId, title, coverUrl } = json;

  try {
    const existing = await prisma.libraryBook.findFirst({
      where: { userId, bookId },
      select: { id: true },
    });

    const book = existing
      ? await prisma.libraryBook.update({
          where: { id: existing.id },
          data: { title, coverUrl },
        })
      : await prisma.libraryBook.create({
          data: { userId, bookId, title, coverUrl },
        });

    return NextResponse.json(book, { status: 201 });
  } catch (err: unknown) {
    console.error("❌ Error en POST /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ❌ DELETE → eliminar un libro de la biblioteca
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const bookId = (json as { bookId?: unknown })?.bookId;

  if (typeof bookId !== "string" || bookId.length === 0) {
    return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
  }

  try {
    await prisma.libraryBook.deleteMany({
      where: { userId, bookId },
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Error en DELETE /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
