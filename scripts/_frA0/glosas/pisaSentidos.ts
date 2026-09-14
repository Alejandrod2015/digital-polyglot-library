// Pisa, historia a historia, la glosa global de varios sentidos con el sentido
// de SU frase (sentidos.json). El trozo (c) y la traduccion se conservan tal
// cual; solo cambia g (y t cuando el sentido cambia de clase). Escribe con
// writeGlossLayer, que es el camino de la capa.
//   npx tsx scripts/_frA0/glosas/pisaSentidos.ts [--dry]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
const B = "french-friends-a0", D = "scripts/_frA0/glosas";
const PROHIBIDO = new RegExp("[=\\u2013\\u2014]");
(async () => {
  const dry = process.argv.includes("--dry");
  const S = JSON.parse(fs.readFileSync(`${D}/sentidos.json`, "utf8")) as Record<string, any>;
  delete S._nota;
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const capa = new Map(rows.map((r) => [r.slug, r.glosses as Record<string, any>]));
  const malas: string[] = [];
  fs.mkdirSync(`${D}/pisadas`, { recursive: true });
  let n = 0;
  for (const [slug, claves] of Object.entries(S)) {
    const fila = capa.get(slug);
    if (!fila) { malas.push(`${slug}: sin fila de capa`); continue; }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(claves)) {
      const e = fila[k];
      if (!e?.c) { malas.push(`${slug}: ${k} no tiene trozo en la capa`); continue; }
      if (PROHIBIDO.test(v.g)) malas.push(`${slug}: ${k} lleva = o guion largo`);
      out[k] = { es: e.c.es, en: e.c.en, g: v.g, ...(v.t ? { t: v.t } : {}) };
      n++;
    }
    fs.writeFileSync(`${D}/pisadas/${slug}.json`, JSON.stringify(out, null, 1) + "\n");
  }
  if (malas.length) { console.error(malas.join("\n")); process.exit(1); }
  if (!dry) for (const slug of Object.keys(S))
    console.log(execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", B, slug, `${D}/pisadas/${slug}.json`], { encoding: "utf8" }).trim());
  console.log(`${n} glosas pisadas en ${Object.keys(S).length} historias${dry ? " (dry)" : ""}`);
  await p.$disconnect();
})();
