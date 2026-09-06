import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const w = { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "pescados-de-dos-metros" } };
  const fila = await p.tapGlossSet.findUnique({ where: w });
  const g = fila!.glosses as Record<string, any>;
  delete g["apostemos"];
  await p.tapGlossSet.update({ where: w, data: { glosses: g } });
  console.log("apostemos borrada de la capa de la historia");
  await p.$disconnect();
})();
