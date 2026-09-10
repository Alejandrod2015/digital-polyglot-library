// Scratch: marca rev:true en glosas GLOBALES del bundle B1 ya leidas contra su frase,
// con arreglo opcional de la glosa. Uso: _marcaRev.ts <json {palabra: {g?, t?}}>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-spain-b1";
(async () => {
  const arreglos = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Record<string, { g?: string; t?: string }>;
  const p = new PrismaClient();
  const f = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!;
  const g = f.glosses as Record<string, { g: string; t: string; rev?: boolean }>;
  for (const [w, a] of Object.entries(arreglos)) {
    if (!g[w]) { console.log(`FALTA global: ${w}`); continue; }
    g[w] = { ...g[w], ...a, rev: true };
    console.log(`rev ${w}: ${g[w].g} [${g[w].t}]`);
  }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: g } });
  await p.$disconnect();
})();
