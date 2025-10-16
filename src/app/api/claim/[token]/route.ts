import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { auth } from "@clerk/nextjs/server";
import { books as bookCatalog } from "@/data/books-basic";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

const CLERK_API_URL = process.env.CLERK_API_URL ?? "https://api.clerk.com";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function patchUserMetadata(userId: string, books: string[]) {
  if (!CLERK_SECRET_KEY) throw new Error("Missing CLERK_SECRET_KEY");

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

export async function GET(req: Request, context: { params: Promise<{ token: string }> }) {
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

    // ♻️ Token ya redimido → idempotente
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

    // 🔹 Actualiza Clerk y My Library si hay usuario autenticado
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

    // Si el correo venía con ?book=slug, redirige directamente al libro
    if (bookSlug && bookCatalog[bookSlug]) {
      console.log("➡️ Redirigiendo al libro:", bookSlug);
      return redirect(`/books/${bookSlug}`);
    }

    // 🎨 Devuelve detalles de libros
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
