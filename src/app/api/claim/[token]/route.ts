// /src/app/api/claim/[token]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getBookMeta } from "@/lib/books";
import { getCatalogBookMeta } from "@/lib/catalog";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

const METADATA_ATTEMPTS = 4;
const METADATA_BACKOFF_MS = [0, 500, 1500, 3000];

/**
 * Actualiza publicMetadata.books del usuario en Clerk. Devuelve true solo si
 * Clerk confirmó la escritura.
 *
 * WHY (2026-09-18): la web decide el acceso a un libro por
 * publicMetadata.books, no por la fila LibraryBook. El 16/09 un comprador
 * canjeó su enlace UN SEGUNDO después de crear la cuenta; esta función falló
 * (probablemente Clerk aún no servía la cuenta), el error se tragó en el
 * catch, la fila se escribió igual y la respuesta dijo "entregado". Resultado:
 * cliente con el libro en la base y el muro de pago en la web. Ahora reintenta
 * con espera, y si aun así falla lo dice, para que el canje NO se dé por
 * entregado y el comprador pueda reintentar.
 *
 * `updateUserMetadata` fusiona por clave: las otras claves (plan,
 * signupSource, signupPlatform) se conservan sin releerlas ni reenviarlas, así
 * que tampoco puede pisar una escritura concurrente del sello de plataforma.
 */
async function patchUserMetadata(userId: string, books: string[]): Promise<boolean> {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) {
    console.error("❌ Falta CLERK_SECRET_KEY");
    return false;
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecret });
  let lastError = "";

  for (let attempt = 0; attempt < METADATA_ATTEMPTS; attempt += 1) {
    if (METADATA_BACKOFF_MS[attempt]) {
      await new Promise((resolve) => setTimeout(resolve, METADATA_BACKOFF_MS[attempt]));
    }
    try {
      const user = await clerkClient.users.getUser(userId);
      const existingMeta = (user.publicMetadata ?? {}) as Record<string, unknown>;
      const currentBooks = Array.isArray(existingMeta.books)
        ? (existingMeta.books as unknown[]).filter((b): b is string => typeof b === "string")
        : [];
      const updatedBooks = Array.from(new Set([...currentBooks, ...books]));

      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { books: updatedBooks },
      });

      console.log("✅ Clerk metadata fusionada para:", userId, updatedBooks);
      return true;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️ Clerk metadata intento ${attempt + 1}/${METADATA_ATTEMPTS} falló para ${userId}: ${lastError}`
      );
    }
  }

  console.error(
    `🚨 CLAIM SIN METADATA; userId=${userId} libros=${JSON.stringify(books)} ` +
      `error=${lastError}; el comprador NO ve estos libros en la web. ` +
      `Reparar con scripts/_repairClaimBooks.ts <userId> --apply.`
  );
  return false;
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
        {
          code: "invalid",
          error: "This access link is not valid or has expired.",
        },
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
          code: "usedByAnother",
          error:
            "This access link has already been used by another account. If you think this is a mistake, write to support@digitalpolyglot.com.",
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

    // 🧩 Si hay sesión, sincronizar Clerk + My Library.
    //
    // 🚨 REGLA (2026-07-29): la respuesta de este endpoint NO puede decir
    // "libros agregados" salvo que la fila de LibraryBook exista de verdad.
    // El 2026-07-28 una clienta canjeó su enlace, el upsert falló (compute de
    // Neon dormido: el reintento P1001 se añadió ese mismo día), el error se
    // tragó en el catch, y la respuesta igual dijo OK. Vio su biblioteca
    // vacía, dedujo que el pago no había entrado y COMPRÓ EL MISMO LIBRO
    // OTRA VEZ. Lo que sigue cuenta entregas reales y las reporta.
    const grantedBookIds: string[] = [];
    const failedBookIds: string[] = [];
    let unresolvedBookIds: string[] = [];
    let alreadyOwned = false;

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

        unresolvedBookIds = unresolved;
        if (unresolved.length > 0) {
          console.error(
            `🚨 CLAIM SIN CATÁLOGO; userId=${userId} buyer=${redeemed.buyerEmail} ` +
              `sin_resolver=${JSON.stringify(unresolved)}; NO materializado. ` +
              `Mapear en shopifybundles.ts o cargar el libro en el catálogo.`
          );
        }

        if (resolved.length > 0) {
          // Saber qué tenía ANTES distingue "te lo acabamos de dar" de "ya lo
          // tenías", que es justo la señal de una compra duplicada.
          const preexisting = await prisma.libraryBook.findMany({
            where: { userId, bookId: { in: resolved.map((r) => r.bookId) } },
            select: { bookId: true },
          });
          const ownedBefore = new Set(preexisting.map((row) => row.bookId));
          alreadyOwned = ownedBefore.size === resolved.length;

          const metadataOk = await patchUserMetadata(
            userId,
            resolved.map((r) => r.bookId)
          );

          // Sin metadata no hay libro en la web, así que tampoco se escribe
          // la fila: un "entregado" a medias es justo lo que pasó el 16/09.
          // El canje queda asignado al usuario y la ruta lo reintenta entera
          // en la siguiente visita al enlace.
          if (!metadataOk) {
            for (const r of resolved) failedBookIds.push(r.bookId);
          }

          // Un libro que falla no puede impedir la entrega de los demás: cada
          // upsert va aislado y se contabiliza por separado.
          for (const r of metadataOk ? resolved : []) {
            try {
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
              grantedBookIds.push(r.bookId);
            } catch (upsertErr) {
              failedBookIds.push(r.bookId);
              const msg =
                upsertErr instanceof Error ? upsertErr.message : String(upsertErr);
              console.error(
                `🚨 CLAIM NO MATERIALIZADO; userId=${userId} buyer=${redeemed.buyerEmail} ` +
                  `token=${token} libro=${r.bookId} error=${msg}; el comprador NO tiene ` +
                  `este libro en My Library. La respuesta se lo dice y puede reintentar.`,
                upsertErr
              );
            }
          }

          if (grantedBookIds.length > 0) {
            // 🔥 INVALIDAR CACHE DE LA BIBLIOTECA DEL USUARIO
            revalidateTag("library-by-user");
          }

          if (ownedBefore.size > 0) {
            // Señal para soporte: pagó dos veces por lo mismo. La primera
            // clienta a la que le pasó (2026-07-28) tuvo que pedir reembolso
            // por su cuenta porque nada avisó.
            console.warn(
              `💸 CLAIM DUPLICADO; userId=${userId} buyer=${redeemed.buyerEmail} ` +
                `token=${token} ya_tenia=${JSON.stringify([...ownedBefore])}; ` +
                `posible cobro doble, revisar reembolso.`
            );
          }
        }

        console.log(
          `📚 My Library sincronizada para: ${userId} ` +
            `(entregados=${grantedBookIds.length} fallidos=${failedBookIds.length} ` +
            `sin_resolver=${unresolved.length})`
        );
      } catch (libErr) {
        // Fallo antes o alrededor del bucle (p.ej. la lectura del catálogo):
        // nada se entregó, y la respuesta lo va a reflejar.
        const msg = libErr instanceof Error ? libErr.message : String(libErr);
        for (const bookId of redeemed.books) {
          if (!grantedBookIds.includes(bookId) && !failedBookIds.includes(bookId)) {
            failedBookIds.push(bookId);
          }
        }
        console.error(
          `🚨 CLAIM NO MATERIALIZADO; userId=${userId} buyer=${redeemed.buyerEmail} ` +
            `token=${token} libros=${JSON.stringify(redeemed.books)} error=${msg}; ` +
            `el comprador NO tiene los libros en My Library.`,
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

    // La entrega es la fila de LibraryBook, no el marcado del token. Solo
    // decimos que está en su cuenta cuando TODOS los libros del enlace están.
    const undelivered = [...failedBookIds, ...unresolvedBookIds];
    const delivered = undelivered.length === 0 && grantedBookIds.length > 0;

    if (!delivered) {
      return NextResponse.json(
        {
          code: "notDelivered",
          delivered: false,
          books: detailedBooks,
          grantedBooks: grantedBookIds,
          pendingBooks: undelivered,
          error:
            "We could not add these books to your library just now. Your purchase is safe and you have not been charged again.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      code: alreadyOwned ? "alreadyOwned" : "granted",
      delivered: true,
      alreadyOwned,
      books: detailedBooks,
      grantedBooks: grantedBookIds,
      redeemedBy: userId,
    });
  } catch (err) {
    console.error("💥 Error en el proceso de redención:", err);
    return NextResponse.json(
      {
        code: "serverError",
        delivered: false,
        error:
          "Something went wrong on our side. Your purchase is safe and you have not been charged again.",
      },
      { status: 500 }
    );
  }
}
