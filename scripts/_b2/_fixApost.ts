import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const w = { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "pescados-de-dos-metros" } };
  const fila = await p.tapGlossSet.findUnique({ where: w });
  const g = fila!.glosses as Record<string, any>;
  const e = { g: "bet placed, agreed (apostar)", t: "verb", c: { es: "“Apostado”, dice él", en: "bet placed, he says" }, rev: true };
  g["apostado"] = e;
  g["apostar"] = { ...g["apostar"], c: { es: "“Apostado”, dice él", en: "bet placed, he says" } };
  g["apostemos"] = g["apostemos"]; // se queda como huérfana inofensiva del lookup
  await p.tapGlossSet.update({ where: w, data: { glosses: g } });
  console.log("ok");
  await p.$disconnect();
})();
