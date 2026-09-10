import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "se-le-escapan-las-palabras" } } });
  const gl = fila!.glosses as Record<string, any>;
  for (const k of ["rentar", "rentando"]) if (gl[k]) gl[k] = { ...gl[k], g: "renting (rentar, loan word)" };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "se-le-escapan-las-palabras" } }, data: { glosses: gl } });
  console.log("ok");
  await p.$disconnect();
})();
