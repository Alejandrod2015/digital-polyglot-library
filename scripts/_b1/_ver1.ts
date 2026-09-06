import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug: "celia-no-dice-que-si" } } });
  const g = f!.glosses as Record<string, any>;
  for (const w of ["enseñado", "habitación", "cuarto", "ascensor", "casero"])
    console.log(w.padEnd(12), JSON.stringify(g[w]));
  await p.$disconnect();
})();
