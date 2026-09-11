/** Solo lee: imprime g, c y rev de unas claves del bundle B2, por fila. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const keys = process.argv.slice(2);
  for (const f of await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b2" } })) {
    const g = f.glosses as Record<string, any>;
    for (const k of keys) if (g[k]) console.log(`${f.slug || "global"} · ${k} · g=${JSON.stringify(g[k].g)} · c=${JSON.stringify(g[k].c?.es ?? null)} · rev=${g[k].rev}`);
  }
  await p.$disconnect();
})();
