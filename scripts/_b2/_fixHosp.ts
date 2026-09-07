import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const w = { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "pescados-de-dos-metros" } };
  const fila = await p.tapGlossSet.findUnique({ where: w });
  const g = fila!.glosses as Record<string, any>;
  g["hospedaje"] = { ...g["hospedaje"], c: { es: "dueña del hospedaje", en: "owner of the guesthouse" } };
  await p.tapGlossSet.update({ where: w, data: { glosses: g } });
  console.log("hospedaje arreglado");
  await p.$disconnect();
})();
