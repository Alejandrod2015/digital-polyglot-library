/** Aplica las correcciones de las copias leidas contra su frase y marca TODAS
 *  las copias como leidas (rev:true). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const corr = JSON.parse(fs.readFileSync("scripts/_deA2/correcciones.json", "utf8")) as Record<string,{g:string;t:string}>;
  const row = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "german-friends-a2", slug: "" } } });
  const g = row!.glosses as Record<string, any>;
  let cambiadas = 0, leidas = 0, faltan: string[] = [];
  for (const [w, v] of Object.entries(corr)) {
    if (!g[w]) { faltan.push(w); continue; }
    g[w].g = v.g; g[w].t = v.t; cambiadas++;
  }
  for (const v of Object.values(g)) if (v.rev === false) { v.rev = true; leidas++; }
  if (faltan.length) { console.error("no estan en el bundle:", faltan.join(", ")); process.exit(1); }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "german-friends-a2", slug: "" } }, data: { glosses: g as never } });
  console.log(`${cambiadas} corregidas, ${leidas} marcadas como leidas, ${Object.keys(g).length} entradas`);
  await p.$disconnect();
})();
