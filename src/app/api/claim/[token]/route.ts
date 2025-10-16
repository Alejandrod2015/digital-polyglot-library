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

    console.log("🔑 Clerk userId:", userId);
    console.log("🎟️ Claim request recibido:", token);

    const claim = await prisma.claimToken.findUnique({ where: { token } });

    if (!claim) {
      console.warn("🚫 Token inválido o inexistente");
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // ♻️ Idempotente: si ya fue usado, no falla
    let redeemed = claim;
    if (!claim.redeemedAt) {
      redeemed = await prisma.claimToken.update({
        where: { token },
        data: {
          redeemedAt: new Date(),
          ...(userId ? { redeemedBy: userId } : {}),
        },
      });
      console.log("✅ Token redimido:", redeemed.token, "por:", userId ?? "invitado");
    } else {
      console.log("♻️ Token ya redimido previamente.");
    }

    // 🔹 Sincroniza Clerk + My Library si hay usuario autenticado
    if (userId) {
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
    }

    // 🚀 Si llega con ?book=slug válido, redirige al libro
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
      message: userId
        ? "Books added to your account"
        : "Claim redeemed successfully (no Clerk user)",
      books: detailedBooks,
      redeemedBy: userId ?? null,
    });
  } catch (err) {
    console.error("💥 Error en claim:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
