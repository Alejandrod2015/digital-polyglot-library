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
    // 1) Lee el metadata actual
    const user = await clerkClient.users.getUser(userId);
    const existingMeta = (user.publicMetadata ?? {}) as Record<string, unknown>;

    const currentBooks = Array.isArray(existingMeta.books)
      ? (existingMeta.books as string[])
      : [];

    // 2) Fusiona libros sin perder otras claves (plan/membership/etc.)
    const updatedBooks = Array.from(new Set([...currentBooks, ...books]));
    const newMeta: Record<string, unknown> = {
      ...existingMeta,
      books: updatedBooks,
    };

    // 3) Actualiza Clerk preservando el resto de publicMetadata
    await clerkClient.users.updateUser(userId, { publicMetadata: newMeta });

    console.log("✅ Clerk metadata fusionada para:", userId, newMeta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("💥 Error actualizando metadata en Clerk:", msg);
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
