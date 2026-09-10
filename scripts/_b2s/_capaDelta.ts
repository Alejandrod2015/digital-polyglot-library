/** Que trozos de la capa hay que reescribir tras cambiar el texto: se CONSERVA toda entrada cuyo trozo sigue
 *  siendo cita literal del texto nuevo; se listan (con trozo propuesto) las que no, y las claves nuevas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().¡!¿?;:]/g, "").replace(/\s+/g, " ").trim();
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  const [fichero, salida] = process.argv.slice(2);
  const exempt = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[B];
  const ex = new Set<string>([...exempt.articles, ...exempt.numerals, ...exempt.characterNames].map((x: string) => x.toLowerCase()));
  const out: Record<string, Record<string, { es: string; en: string; antes?: string }>> = {};
  for (const s of JSON.parse(fs.readFileSync(fichero, "utf8"))) {
    const slug = slugify(s.title);
    const texto = `${s.title}. ${s.text}`;
    const todo = N(texto);
    const g = ((await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))?.glosses ?? {}) as Record<string, any>;
    const oraciones = texto.split(/(?<=[.?!…”])\s+/);
    const claves = new Set<string>();
    for (const m of texto.matchAll(/\p{L}[\p{L}\p{M}'-]*/gu)) { const k = m[0].toLowerCase(); if (!ex.has(k)) claves.add(k); }
    for (const v of (s.vocab ?? [])) claves.add(String(v.word).toLowerCase());
    let vivas = 0;
    for (const k of claves) {
      const c = g[k]?.c;
      if (c?.es && todo.includes(N(c.es))) { vivas++; continue; }
      const sup = (s.vocab ?? []).find((v: any) => String(v.word).toLowerCase() === k);
      const busca = N(sup?.surface ?? k);
      const ora = oraciones.find((o: string) => N(o).includes(busca)) ?? "";
      const cl = ora.split(/[,:;“”.!?¿¡]/).map((x: string) => N(x)).filter(Boolean).find((x: string) => x.includes(busca)) ?? busca;
      const t = cl.split(" "); let es = cl;
      if (t.length > 6) { const j = t.findIndex((x: string) => x.includes(busca.split(" ")[0])); const a = Math.max(0, Math.min(j - 2, t.length - 5)); es = t.slice(a, a + 5).join(" "); }
      (out[slug] ??= {})[k] = { es, en: "", ...(c?.es ? { antes: `${c.es} = ${c.en}` } : {}) };
    }
    console.log(`${slug}: ${vivas} entradas siguen vivas · ${Object.keys(out[slug] ?? {}).length} por escribir`);
  }
  fs.writeFileSync(salida, JSON.stringify(out, null, 1));
  await p.$disconnect();
})();
