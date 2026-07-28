// /src/app/api/claim/[token]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getBookMeta } from "@/lib/books";
import { getCatalogBookMeta } from "@/lib/catalog";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

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

    // 🔐 GUARD (2026-07-26): un visitante SIN sesión NO debe mutar el token.
    // Sin userId no se puede conceder ningún libro (el bloque de concesión ya
    // está gateado por `if (userId)`), pero el flujo previo igual estampaba
    // `redeemedAt` en la primera visita deslogueada: dejaba el token
    // "medio consumido" (redeemedAt set / redeemedBy null) y el cliente
    // mostraba un "Books added" engañoso ANTES de iniciar sesión. Confirmado
    // en prod (9/101 tokens en ese estado). Ahora respondemos requiresAuth y
    // no tocamos nada; el cliente pide login y, al volver autenticado, la
    // rama de recuperación de más abajo concede los libros normalmente.
    if (!userId) {
      const detailedBooks = await Promise.all(
        claim.books.map(async (slug) => ({
          id: slug,
          ...(await getBookMeta(slug)),
        }))
      );
      return NextResponse.json({
        requiresAuth: true,
        books: detailedBooks,
        message: "Sign in to add these books to your library.",
      });
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
        // 🛡️ GUARD anti-fantasma: solo concedemos libros que EXISTEN en el
        // catálogo del reader. Un SKU que no resuelve (p.ej. el SKU crudo de
        // Shopify sin mapear en shopifybundles.ts) crearía una entrada fantasma
        // (title = SKU, portada por defecto) en LibraryBook y en Clerk
        // publicMetadata.books. Mejor NO materializar y alertar para repararlo.
        const resolved: Array<{ bookId: string; title: string; cover: string }> = [];
        const unresolved: string[] = [];
        for (const bookId of redeemed.books) {
          const catalog = await getCatalogBookMeta(bookId);
          if (!catalog) {
            unresolved.push(bookId);
            continue;
          }
          const meta = await getBookMeta(bookId);
          resolved.push({ bookId, title: meta.title, cover: meta.cover });
        }

        if (unresolved.length > 0) {
          console.error(
            `🚨 CLAIM SIN CATÁLOGO — userId=${userId} buyer=${redeemed.buyerEmail} ` +
              `sin_resolver=${JSON.stringify(unresolved)} — NO materializado. ` +
              `Mapear en shopifybundles.ts o cargar el libro en el catálogo.`
          );
        }

        if (resolved.length > 0) {
          await patchUserMetadata(
            userId,
            resolved.map((r) => r.bookId)
          );

          for (const r of resolved) {
            await prisma.libraryBook.upsert({
              where: { userId_bookId: { userId, bookId: r.bookId } },
              update: {}, // idempotente
              create: {
                userId,
                bookId: r.bookId,
                title: r.title,
                coverUrl: r.cover,
              },
            });
          }

          // 🔥 INVALIDAR CACHE DE LA BIBLIOTECA DEL USUARIO
          revalidateTag("library-by-user");
        }

        console.log(
          `📚 My Library sincronizada para: ${userId} ` +
            `(concedidos=${resolved.length} sin_resolver=${unresolved.length})`
        );
      } catch (libErr) {
        // 🚨 El upsert de LibraryBook es LA entrega: si falla, el comprador
        // paga y no ve el libro, pero la respuesta sigue diciendo "Books
        // added". Alertamos con el mismo formato que el guard anti-fantasma
        // para poder repararlo a mano (2026-07-28).
        const msg = libErr instanceof Error ? libErr.message : String(libErr);
        console.error(
          `🚨 CLAIM NO MATERIALIZADO — userId=${userId} buyer=${redeemed.buyerEmail} ` +
            `token=${token} libros=${JSON.stringify(redeemed.books)} error=${msg} — ` +
            `el usuario NO tiene los libros en My Library pese a la respuesta OK.`,
          libErr
        );
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
