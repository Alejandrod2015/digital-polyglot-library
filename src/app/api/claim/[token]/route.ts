// /src/app/api/claim/[token]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getBookMeta } from "@/lib/books";

const prisma = new PrismaClient();

/**
 * Actualiza los metadatos públicos del usuario en Clerk con sus nuevos libros.
 */
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

    const updatedBooks = [...new Set([...currentBooks, ...books])];
    await clerkClient.users.updateUser(userId, {
      publicMetadata: { books: updatedBooks },
    });

    console.log("✅ Clerk metadata updated for:", userId, updatedBooks);
  } catch (err: any) {
    console.error("💥 Clerk metadata update failed:", err?.message || err);
  }
}

/**
 * Handler principal de redención de token
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
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

    // ♻️ Token idempotente
    let redeemed = claim;
    if (!claim.redeemedAt) {
      redeemed = await prisma.claimToken.update({
        where: { token },
        data: { redeemedAt: new Date(), redeemedBy: userId ?? null },
      });
      console.log("✅ Token redimido por:", userId ?? "invitado");
    } else if (!claim.redeemedBy && userId) {
      await prisma.claimToken.update({
        where: { token },
        data: { redeemedBy: userId },
      });
      console.log("🔁 Token re-asignado a:", userId);
    } else {
      console.log("♻️ Token ya redimido previamente.");
    }

    // 🔹 Si hay sesión, sincroniza Clerk + My Library
    if (userId) {
      try {
        await patchUserMetadata(userId, redeemed.books);

        for (const bookId of redeemed.books) {
          const meta = await getBookMeta(bookId);
          await prisma.libraryBook.upsert({
            where: { userId_bookId: { userId, bookId } },
            update: {},
            create: {
              userId,
              bookId,
              title: meta.title,
              coverUrl: meta.cover,
            },
          });
        }
        console.log("📚 My Library sincronizada para:", userId);
      } catch (libErr) {
        console.error("⚠️ Error actualizando My Library:", libErr);
      }
    }

    // 🎨 Devuelve detalles de libros desde Sanity
    const detailedBooks = await Promise.all(
      redeemed.books.map(async (slug) => ({
        id: slug,
        ...(await getBookMeta(slug)),
      }))
    );

    return NextResponse.json({
      message: claim.redeemedAt
        ? "Books already in your account"
        : "Books added to your account",
      books: detailedBooks,
      redeemedBy: userId ?? null,
    });
  } catch (err) {
    console.error("💥 Error en claim:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
