import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: b, slug: "" } } });
  const hechas = new Set((await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { slug: true, glosses: true } }))
    .filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((e) => e.c)).map((f) => f.slug));
  console.log("faltan:", g!.slugs.filter((s) => !hechas.has(s)).join(" "));
  await p.$disconnect();
})();
