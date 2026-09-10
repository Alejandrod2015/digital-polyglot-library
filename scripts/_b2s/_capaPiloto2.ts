/** Escribe la capa del piloto en dos vias: lo que la global ya conoce, por writeGlossLayer (fichero
 *  filtrado); las claves de LEMA/expresion del vocab, a mano: glosa en la global + trozo en la historia. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync, writeFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const G: Record<string, [string, string]> = {
  encargar: ["to ask someone to do a job (encargar)", "verb"], caber: ["to fit, to have room (caber)", "verb"],
  tapar: ["to cap, to cover (tapar)", "verb"], apuntar: ["to write down (apuntar)", "verb"],
  aburrirse: ["to get bored (aburrirse)", "verb"], "caer en la cuenta": ["to realise, suddenly understand", "expression"],
  "calentarse la cara": ["to blush, feel your face go hot", "expression"],
  ensayar: ["to rehearse (ensayar)", "verb"], redondear: ["to round off (redondear)", "verb"],
  "salirse con la suya": ["to get your own way", "expression"], guardar: ["to keep, to save (guardar)", "verb"],
  repartir: ["to share out (repartir)", "verb"], durar: ["to last (durar)", "verb"],
  "tomar por": ["to take for, to mistake for", "expression"], "tocarle a alguien": ["to be someone's turn", "expression"],
  soltar: ["to let go (soltar)", "verb"], acercar: ["to bring closer (acercar)", "verb"],
  costar: ["to cost, to be hard for (costar)", "verb"], levantarse: ["to get up (levantarse)", "verb"],
  "vacío": ["empty", "adjective"], "dejar ir": ["to let go of", "expression"], "dar igual": ["not to mind, to be all the same", "expression"],
};
(async () => {
  const fg = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  const glob = { ...(fg!.glosses as Record<string, any>) };
  let alta = 0;
  for (const [k, [g, t]] of Object.entries(G)) if (!glob[k]) { glob[k] = { g, t }; alta++; }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: glob } });
  console.log(`global: +${alta} claves de lema`);
  for (const slug of ["el-cafe-lo-pones-tu", "la-bolsa-como-prueba", "la-sobremesa-se-estira"]) {
    const capa = JSON.parse(readFileSync(`scripts/_b2s/piloto/capa-${slug}.json`, "utf8")) as Record<string, { es: string; en: string }>;
    const tocables = Object.fromEntries(Object.entries(capa).filter(([k]) => !G[k]));
    writeFileSync(`scripts/_b2s/piloto/capa-${slug}.tocables.json`, JSON.stringify(tocables, null, 1));
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const cap = { ...(fila!.glosses as Record<string, any>) };
    let n = 0;
    for (const [k, v] of Object.entries(capa)) if (G[k]) { cap[k] = { ...(cap[k] ?? {}), g: G[k][0], t: G[k][1], c: { es: v.es, en: v.en } }; n++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: cap } });
    console.log(`${slug}: ${n} claves de lema con trozo · ${Object.keys(tocables).length} tocables para writeGlossLayer`);
  }
  await p.$disconnect();
})();
