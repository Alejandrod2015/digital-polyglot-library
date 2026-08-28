import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: process.argv[2], slug: "" } } });
  const g = f!.glosses as Record<string, { g: string; t: string }>;
  for (const [w, e] of Object.entries(g)) if (/name|^\(/i.test(e.g)) console.log(`${w} = ${e.g} (${e.t})`);
  await p.$disconnect();
})();
