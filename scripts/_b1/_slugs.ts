import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const t = await p.$queryRawUnsafe<Array<{ slug: string; label: string }>>(
    `SELECT "slug","label" FROM "dp_topics_v1" ORDER BY "slug"`);
  console.log(t.length, "temas en el catalogo");
  for (const c of ["room", "flat", "meeting", "deadline", "class", "exam", "rent", "office", "study", "winter", "storm"])
    for (const x of t) if (x.slug.includes(c)) console.log(`  ${c}: ${x.slug} = ${x.label}`);
  await p.$disconnect();
})();
