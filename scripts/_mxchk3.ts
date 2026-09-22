import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const b of ["spanish-friends-mexico"]) {
    const g: any = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: b, slug: "" } } });
    console.log(b, g.slugs);
  }
  await p.$disconnect();
})();
