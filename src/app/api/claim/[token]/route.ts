// /src/app/api/claim/[token]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { books as bookCatalog } from "@/data/books-basic";

const prisma = new PrismaClient();

async function patchUserMetadata(userId: string, books: string[]): Promise<void> {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) {
    console.error("❌ Missing CLERK_SECRET_KEY");
    return;
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret });

  try {
    const user = await clerkClient.users.getUser(userId);
    const currentBooks = Array.isArray(user.publicMetadata?.books)
      ? (user.publicMetadata.books as string[])
      : [];

    const updatedBooks = Array.from(new Set([...currentBooks, ...books]));

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { books: updatedBooks },
    });

    console.log("🎉 Clerk metadata updated for:", userId);
  } catch (err) {
    console.error("💥 Error updating Clerk metadata:", err);
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const url = new URL(req.url);
    const bookSlug = url.searchParams.get("book") ?? null;
    const { params } = await context;
    const { token } = await params;
    const { userId } = await auth();

    console.log("🎟️ Claim recibido:", token);
    console.log("🔑 Clerk userId:", userId ?? "no-session");

    const claim = await prisma.claimToken.findUnique({ where: { token } });

    if (!claim) {
      console.warn("🚫 Token inválido o inexistente");
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // 🚪 Si no hay sesión activa, redirige a sign-in conservando el token
    if (!userId) {
      const signInUrl = `${url.origin}/sign-in?redirect_url=/claim/${token}`;
      console.log("🔁 Redirigiendo a login:", signInUrl);
      return NextResponse.redirect(signInUrl);
    }

    // ♻️ Token idempotente
    let redeemed = claim;
    if (!claim.redeemedAt) {
  redeemed = await prisma.claimToken.update({
    where: { token },
    data: { redeemedAt: new Date(), redeemedBy: userId },
  });
  console.log("✅ Token redimido por:", userId);
} else {
  // ⚡ Reasignar el token al nuevo usuario logueado si fuera necesario
  if (!claim.redeemedBy && userId) {
    await prisma.claimToken.update({
      where: { token },
      data: { redeemedBy: userId },
    });
    console.log("🔁 Token re-asignado a:", userId);
  }
  console.log("♻️ Token ya redimido previamente.");
}

    // 🔹 Sincroniza Clerk + My Library
    try {
      await patchUserMetadata(userId, redeemed.books);

      for (const bookId of redeemed.books) {
        const meta = bookCatalog[bookId];
        await prisma.libraryBook.upsert({
          where: { userId_bookId: { userId, bookId } },
          update: {},
          create: {
            userId,
            bookId,
            title: meta?.title ?? bookId,
            coverUrl: meta?.cover ?? "/covers/default.jpg",
          },
        });
      }
      console.log("📚 My Library sincronizada para:", userId);
    } catch (libErr) {
      console.error("⚠️ Error actualizando My Library:", libErr);
    }

    // 🚀 Redirige al libro si venía con ?book=slug válido
    if (bookSlug && bookCatalog[bookSlug]) {
      console.log("➡️ Redirigiendo al libro:", bookSlug);
      return NextResponse.redirect(`${url.origin}/books/${bookSlug}`);
    }

    // 🎨 Devuelve detalles de libros (para la UI de claim)
    const detailedBooks = redeemed.books.map((id) => ({
      id,
      ...(bookCatalog[id] ?? { title: id, cover: "", description: "" }),
    }));

    return NextResponse.json({
      message: "Books added to your account",
      books: detailedBooks,
      redeemedBy: userId,
    });
  } catch (err) {
    console.error("💥 Error en claim:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
