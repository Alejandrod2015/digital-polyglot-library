// src/app/api/claims/[token]/route.ts

import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { auth } from "@clerk/nextjs/server";

const prisma = new PrismaClient();

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { userId } = await auth();
    console.log("🔑 Clerk userId:", userId);

    const token = params.token;
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

    // 3️⃣ Responder con los libros
    return NextResponse.json({
      message: "Claim redeemed successfully",
      books: updated.books,
      redeemedBy: userId ?? null,
    });
  } catch (err) {
    console.error("💥 Error en claim:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
