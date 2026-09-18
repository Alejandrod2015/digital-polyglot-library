// Repara un canje que dejo la fila LibraryBook pero no el libro en
// publicMetadata.books de Clerk (la web decide por metadata, asi que el
// comprador ve el muro). Anade los libros de sus claims canjeados sin tocar
// el resto de la metadata.
//
//   CLERK_SECRET_KEY=sk_live_... npx tsx scripts/_repairClaimBooks.ts <userId> [--apply]
//
// Sin --apply solo imprime lo que haria.
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function run() {
  const userId = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!userId) {
    console.error("uso: _repairClaimBooks.ts <userId> [--apply]");
    process.exit(1);
  }
  const key = process.env.CLERK_SECRET_KEY ?? "";
  console.log(`instancia Clerk: ${key.startsWith("sk_live_") ? "LIVE" : key.startsWith("sk_test_") ? "DEV" : "desconocida"}`);
  const clerk = createClerkClient({ secretKey: key });

  const claims = await prisma.claimToken.findMany({
    where: { redeemedBy: userId },
    select: { books: true, redeemedAt: true },
  });
  const fromClaims = Array.from(new Set(claims.flatMap((c) => c.books)));
  console.log(`claims canjeados: ${claims.length} | libros: ${fromClaims.join(", ") || "-"}`);
  if (fromClaims.length === 0) {
    console.log("nada que reparar: este usuario no canjeo ningun claim");
    await prisma.$disconnect();
    return;
  }

  const user = await clerk.users.getUser(userId);
  const meta = (user.publicMetadata ?? {}) as Record<string, unknown>;
  const current = Array.isArray(meta.books) ? meta.books.filter((b): b is string => typeof b === "string") : [];
  const merged = Array.from(new Set([...current, ...fromClaims]));
  const missing = merged.filter((b) => !current.includes(b));

  console.log(`${user.primaryEmailAddress?.emailAddress ?? userId}`);
  console.log(`books antes:   [${current.join(", ")}]`);
  console.log(`books despues: [${merged.join(", ")}]`);
  if (missing.length === 0) {
    console.log("ya estaba completo; no se escribe nada");
  } else if (!apply) {
    console.log(`faltan ${missing.length}; vuelve a correr con --apply para escribirlo`);
  } else {
    // updateUserMetadata fusiona por clave: signupSource y signupPlatform
    // se conservan sin reenviarlos.
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { books: merged } });
    const after = await clerk.users.getUser(userId);
    console.log(`escrito. metadata ahora: ${JSON.stringify(after.publicMetadata)}`);
  }
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
