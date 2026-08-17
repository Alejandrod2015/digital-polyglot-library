import { readFileSync } from "node:fs";
import { PrismaClient } from "/Users/alejandrodelcarpio/digital-polyglot-library/src/generated/prisma";

const env = readFileSync("/Users/alejandrodelcarpio/digital-polyglot-library/.env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)![1].trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url } } });

const mask = (e?: string | null) => {
  if (!e) return String(e);
  const [u, d] = e.split("@");
  return d ? `${u.slice(0, 3)}***@${d}` : e;
};

async function main() {
  const recent = await prisma.claimToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  console.log(`=== Últimos ${recent.length} ClaimToken ===`);
  for (const c of recent) {
    // ¿el/los libro(s) resuelven en el catálogo del reader?
    const cat = await prisma.catalogBook.findMany({
      where: { slug: { in: c.books } },
      select: { slug: true, title: true },
    });
    const resolved = new Set(cat.map((x) => x.slug));
    console.log(
      JSON.stringify({
        buyer: mask(c.buyerEmail),
        books: c.books,
        booksResuelven: c.books.map((b) => (resolved.has(b) ? "OK" : "NO-CATALOGO")),
        redeemedBy: c.redeemedBy,
        redeemedAt: c.redeemedAt,
        createdAt: c.createdAt,
        tokenTail: c.token.slice(-6),
      })
    );
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error("ERR:", e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
