/** Vuelca la capa de contexto de una historia del B1, trozo por trozo y sin
 *  repetir, para leerla como la lee quien toca una palabra. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const f = await p.tapGlossSet.findFirst({
    where: { bundle: "portuguese-traveler-brazil-b1", slug }, select: { glosses: true },
  });
  const vistos = new Set<string>();
  for (const v of Object.values((f?.glosses ?? {}) as Record<string, { c?: { es?: string; en?: string } }>)) {
    const c = v?.c;
    if (!c?.es || vistos.has(c.es)) continue;
    vistos.add(c.es);
    console.log(`${c.es}\n   ${c.en}`);
  }
  console.log(`\n${vistos.size} trozos`);
  await p.$disconnect();
})();
