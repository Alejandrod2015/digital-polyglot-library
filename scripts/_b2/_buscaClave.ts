import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-latam-b2" }, select: { slug: true, glosses: true } });
  for (const key of process.argv.slice(2)) {
    console.log(`\n== ${key} ==`);
    for (const r of rows) {
      const g = (r.glosses as Record<string, any>)[key];
      if (g) console.log(`${r.slug || "(global)"}: ${JSON.stringify(g)}`);
    }
  }
  await p.$disconnect();
})();
