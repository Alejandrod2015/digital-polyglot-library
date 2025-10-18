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
    console.error("❌ Falta CLERK_SECRET_KEY");
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

    console.log("✅ Clerk metadata actualizada para:", userId, updatedBooks);
  } catch (err: any) {
    console.error("💥 Error actualizando metadata en Clerk:", err?.message || err);
  }
}

/**
 * Endpoint principal de redención de enlaces
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { params } = await context;
    const { token } = await params;
    const { userId } = await auth();

    console.log("🎟️ Solicitud de redención:", token);
    console.log("🔑 Usuario Clerk:", userId ?? "sin sesión");

    const claim = await prisma.claimToken.findUnique({ where: { token } });

    if (!claim) {
      console.warn("🚫 Enlace inválido o inexistente");
      return NextResponse.json(
        { error: "Este enlace de acceso no es válido o ha expirado." },
        { status: 404 }
      );
    }

    // 🔒 Si ya fue usado por otro usuario → bloquear
    if (claim.redeemedBy && claim.redeemedBy !== userId) {
      console.warn(`🚫 Enlace ya usado por otro usuario (${claim.redeemedBy})`);
      return NextResponse.json(
        {
          error:
            "Este enlace de acceso ya fue usado. Si crees que es un error, escríbenos a support@digitalpolyglot.com.",
        },
        { status: 410 }
      );
    }

    // ✅ Si no ha sido redimido, marcarlo
    let redeemed = claim;
    if (!claim.redeemedAt) {
      redeemed = await prisma.claimToken.update({
        where: { token },
        data: {
          redeemedAt: new Date(),
          redeemedBy: userId ?? null,
        },
      });
      console.log("✅ Enlace redimido por:", userId ?? "invitado");
    } else if (!claim.redeemedBy && userId) {
      // Si se usó sin sesión antes, ahora lo asignamos al usuario actual
      redeemed = await prisma.claimToken.update({
        where: { token },
        data: { redeemedBy: userId },
      });
      console.log("🔁 Enlace asignado a usuario:", userId);
    } else {
      console.log("♻️ Enlace ya redimido previamente por este usuario.");
    }

    // 🧩 Si hay sesión, sincronizar Clerk + My Library
    if (userId) {
      try {
        await patchUserMetadata(userId, redeemed.books);

        for (const bookId of redeemed.books) {
          const meta = await getBookMeta(bookId);
          await prisma.libraryBook.upsert({
            where: { userId_bookId: { userId, bookId } },
            update: {}, // idempotente
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

    // 🖼️ Obtener detalles de los libros desde Sanity
    const detailedBooks = await Promise.all(
      redeemed.books.map(async (slug) => ({
        id: slug,
        ...(await getBookMeta(slug)),
      }))
    );

    return NextResponse.json({
      message: claim.redeemedAt
        ? "Estos libros ya están en tu cuenta."
        : "Libros agregados correctamente a tu cuenta.",
      books: detailedBooks,
      redeemedBy: userId ?? null,
    });
  } catch (err) {
    console.error("💥 Error en el proceso de redención:", err);
    return NextResponse.json(
      {
        error:
          "Ocurrió un error interno al procesar tu solicitud. Intenta nuevamente más tarde.",
      },
      { status: 500 }
    );
  }
}
