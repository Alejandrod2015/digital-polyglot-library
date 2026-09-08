import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-latam-b1" }, select: { slug: true, glosses: true } });
  for (const r of rows) for (const [k, v] of Object.entries((r.glosses ?? {}) as Record<string, any>))
    if (v?.rev === false) console.log(r.slug ?? "global", "|", k, "|", v?.t, "|", v?.g);
  await p.$disconnect();
})();
