// src/app/api/claims/[token]/route.ts

import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { auth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

const CLERK_API_URL = process.env.CLERK_API_URL ?? "https://api.clerk.com";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function patchUserMetadata(userId: string, books: string[]) {
  if (!CLERK_SECRET_KEY) throw new Error("Missing CLERK_SECRET_KEY");

  // 1️⃣ Obtener metadata actual
  const getRes = await fetch(`${CLERK_API_URL}/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });

  if (!getRes.ok) {
    console.error("❌ Clerk GET user failed:", getRes.status, await getRes.text());
    return;
  }

  const user: any = await getRes.json();
  const currentBooks = Array.isArray(user.public_metadata?.books)
    ? user.public_metadata.books
    : [];

  const updatedBooks = Array.from(new Set([...currentBooks, ...books]));

  // 2️⃣ Actualizar metadata
  const patchRes = await fetch(`${CLERK_API_URL}/v1/users/${userId}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: { books: updatedBooks } }),
  });

  if (!patchRes.ok) {
    console.error("❌ Clerk PATCH failed:", patchRes.status, await patchRes.text());
  } else {
    console.log("🎉 Clerk metadata updated for:", userId);
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { params } = await context;
    const { token } = await params;
    const { userId } = await auth();

    console.log("🔑 Clerk userId:", userId);
    console.log("🎟️ Claim request recibido:", token);

    // 1️⃣ Buscar token en la base de datos
    const claim = await prisma.claimToken.findUnique({
      where: { token },
    });

    if (!claim) {
      console.warn("🚫 Token no encontrado:", token);
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (claim.redeemedAt) {
      console.warn("⚠️ Token ya utilizado:", token);
      return NextResponse.json({ error: "Token already used" }, { status: 410 });
    }

    // 2️⃣ Marcar como redimido (con userId si existe)
    const updated = await prisma.claimToken.update({
      where: { token },
      data: {
        redeemedAt: new Date(),
        ...(userId ? { redeemedBy: userId } : {}),
      },
    });

    console.log("✅ Token redimido:", updated.token, "por:", userId ?? "invitado");

    // 3️⃣ Si hay sesión Clerk, actualizar metadata
    if (userId) {
      await patchUserMetadata(userId, updated.books);
    }

    // 4️⃣ Responder con los libros
    return NextResponse.json({
      message: userId
        ? "Books added to your account"
        : "Claim redeemed successfully (no Clerk user)",
      books: updated.books,
      redeemedBy: userId ?? null,
    });
  } catch (err) {
    console.error("💥 Error en claim:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
