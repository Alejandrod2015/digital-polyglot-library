/** Borra del bundle las tres glosas de numeral que no debian existir.
 *  El rebuild es ADITIVO, asi que quitarlas del fichero no las quita de la
 *  base: hay que borrarlas aqui. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const NUMS = ["duas", "vinte", "quatro"];

(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let borradas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, unknown>;
    for (const n of NUMS) if (n in g) { delete g[n]; borradas++; }
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug: f.slug } },
      data: { glosses: g as never },
    });
  }
  console.log(`glosas de numeral borradas: ${borradas}`);
  await p.$disconnect();
})();
