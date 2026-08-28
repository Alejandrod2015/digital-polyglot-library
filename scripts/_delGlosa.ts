import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, ...ws] = process.argv.slice(2);
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const g = f!.glosses as Record<string, unknown>;
  for (const w of ws) { console.log(w, w in g ? "borrada" : "no estaba"); delete g[w]; }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { glosses: g as never } });
  await p.$disconnect();
})();
