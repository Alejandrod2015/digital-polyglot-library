// Solo lectura: el campo f de unas palabras en una historia del bundle del A0.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [slug, ...ws] = process.argv.slice(2);
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "portuguese-traveler-brazil-a0", slug } } });
  const g = f!.glosses as Record<string, any>;
  for (const w of ws) console.log(w, JSON.stringify(g[w]));
  await p.$disconnect();
})();
