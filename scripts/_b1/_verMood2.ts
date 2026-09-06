import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1", NOT: { slug: "" } } });
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const w of ["encienda", "faltara", "devuelva", "irá", "hemos", "han", "ha"])
      if (g[w]) console.log(`${f.slug.slice(0,20).padEnd(21)} ${w.padEnd(10)} t=${g[w].t} mood=${g[w].f?.mood ?? "-"} ${JSON.stringify(g[w].f?.head ?? "")}`);
  }
  await p.$disconnect();
})();
