/** Las glosas copiadas sin leer (rev:false) de la fila GLOBAL del bundle, cada una
 *  con la frase de las 21 historias donde cae, para leerlas contra su uso. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } } });
  const g = (fila?.glosses ?? {}) as Record<string, any>;
  const frases: Array<[string, string]> = [];
  for (let t = 1; t <= 7; t++) for (const s of JSON.parse(fs.readFileSync(`scripts/_b2/t${t}.json`, "utf8")))
    for (const f of String(s.text).replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/)) frases.push([s.slug, f]);
  const pend = Object.entries(g).filter(([, v]) => v?.rev === false);
  for (const [k, v] of pend) {
    const re = new RegExp(`(?<![\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu");
    const hit = frases.find(([, f]) => re.test(f));
    console.log(`${k}\t${v?.t ?? ""}\t${v?.g ?? ""}\t${hit ? hit[1].slice(0, 110) : "(no aparece)"}`);
  }
  console.error(`${pend.length} pendientes`);
  await p.$disconnect();
})();
