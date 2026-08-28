import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: process.argv[2], slug: process.argv[3] } } });
  const g = f!.glosses as Record<string, { c?: unknown; g: string }>;
  console.log(Object.entries(g).filter(([, e]) => !e.c).map(([w, e]) => `${w} = ${e.g}`).join("\n") || "(ninguna)");
  await p.$disconnect();
})();
