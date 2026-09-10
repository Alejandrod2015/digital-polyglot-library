import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2", S = "la-sobremesa-se-estira";
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: S } } });
  const g = { ...(fila!.glosses as Record<string, any>) };
  if (!g.costaba?.c) throw new Error("costaba sin trozo");
  g.costaba = { ...g.costaba, g: "was hard for, cost (costar)" };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: S } }, data: { glosses: g } });
  console.log("costaba:", JSON.stringify({ g: g.costaba.g, c: g.costaba.c }));
  await p.$disconnect();
})();
