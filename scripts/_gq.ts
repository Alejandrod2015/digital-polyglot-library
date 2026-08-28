import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: process.argv[2], slug: "" } } });
  const g = f!.glosses as Record<string, { g: string; t: string }>;
  for (const w of process.argv.slice(3)) console.log(w, JSON.stringify(g[w]));
  await p.$disconnect();
})();
