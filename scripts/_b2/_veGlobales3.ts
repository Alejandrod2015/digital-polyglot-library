import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  const g = fila!.glosses as Record<string, any>;
  for (const k of process.argv.slice(2)) console.log(k, JSON.stringify(g[k]));
  await p.$disconnect();
})();
