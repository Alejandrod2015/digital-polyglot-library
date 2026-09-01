import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-friends-argentina", NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  for (const f of filas) for (const [k, v] of Object.entries(f.glosses as Record<string, { c?: { es: string; en: string } }>)) {
    if (v.c?.en === "all at once") console.log(`${f.slug} | ${k} | "${v.c.es}"`);
  }
  await p.$disconnect();
})();
