import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = await p.catalogBook.findMany({
    where: { slug: { in: ["colombian-spanish-stories-for-beginners","short-stories-in-colombian-spanish"] } },
    select: { slug: true, title: true, language: true, published: true },
  });
  for (const x of b) console.log(`${x.slug.padEnd(42)} "${x.title}"`);
  await p.$disconnect();
})();
