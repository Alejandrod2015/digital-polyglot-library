import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const tokens = await p.claimToken.findMany({
    select: { books: true, redeemedBy: true, redeemedAt: true, createdAt: true },
  });
  console.log(`ClaimToken (compras): ${tokens.length} total, ${tokens.filter((t) => t.redeemedBy).length} redimidos`);

  const bought = new Map<string, { tokens: number; redeemed: number }>();
  for (const t of tokens)
    for (const b of t.books) {
      const acc = bought.get(b) ?? { tokens: 0, redeemed: 0 };
      acc.tokens += 1;
      if (t.redeemedBy) acc.redeemed += 1;
      bought.set(b, acc);
    }
  console.log("\n=== LIBROS COMPRADOS (ClaimToken.books) ===");
  [...bought.entries()]
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .forEach(([slug, v]) => console.log(`  ${slug.padEnd(52)} compras=${v.tokens}  redimidas=${v.redeemed}`));

  // Señal de uso real: libros añadidos a la biblioteca personal.
  const lib = await p.libraryBook.groupBy({ by: ["bookId"], _count: { _all: true } });
  console.log("\n=== EN BIBLIOTECAS DE USUARIOS (LibraryBook) ===");
  lib
    .sort((a, b) => b._count._all - a._count._all)
    .forEach((r) => console.log(`  ${r.bookId.padEnd(52)} usuarios=${r._count._all}`));

  // Historias de libro guardadas / leídas
  const libS = await p.libraryStory.groupBy({ by: ["bookId"], _count: { _all: true } });
  console.log("\n=== HISTORIAS DE LIBRO GUARDADAS (LibraryStory) ===");
  libS
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 12)
    .forEach((r) => console.log(`  ${r.bookId.padEnd(52)} guardadas=${r._count._all}`));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
