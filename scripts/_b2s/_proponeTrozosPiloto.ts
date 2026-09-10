/** Trozos constituyentes para las 3 historias del piloto, leidas del JSON (no de la base): clausula que
 *  contiene la palabra, recortada a 5 si se pasa; `en` vacio para escribirlo a mano. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b2";
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, unknown>;
  const exempt = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[B];
  const ex = new Set<string>([...exempt.articles, ...exempt.numerals, ...exempt.characterNames].map((x: string) => x.toLowerCase()));
  const st = JSON.parse(fs.readFileSync("scripts/_b2s/piloto/t1.json", "utf8"));
  const out: Record<string, Record<string, { es: string; en: string }>> = {};
  const sinGlobal: string[] = [];
  for (const s of st) {
    const slug = slugify(s.title);
    const texto = `${s.title}. ${s.text}`;
    const oraciones = texto.split(/(?<=[.?!…”])\s+/);
    const vistas = new Set<string>();
    for (const m of texto.matchAll(TAPPABLE)) {
      const k = m[0].toLowerCase();
      if (vistas.has(k) || ex.has(k)) continue;
      vistas.add(k);
      if (!glob[k]) sinGlobal.push(`${slug}:${k}`);
      const ora = oraciones.find((o) => N(o).split(" ").includes(N(k))) ?? "";
      const cl = ora.split(/[,:;“”.!?¿¡]/).map((x) => N(x)).filter(Boolean).find((x) => x.split(" ").includes(N(k))) ?? N(k);
      const t = cl.split(" ");
      let es = cl;
      if (t.length > 5) { const j = t.indexOf(N(k)); const a = Math.max(0, Math.min(j - 2, t.length - 5)); es = t.slice(a, a + 5).join(" "); }
      (out[slug] ??= {})[k] = { es, en: "" };
    }
  }
  fs.writeFileSync("scripts/_b2s/piloto/trozos-propuestos.json", JSON.stringify(out, null, 1));
  console.log(Object.entries(out).map(([k, v]) => `${k}: ${Object.keys(v).length}`).join(" · "));
  console.log(`sin glosa global (hay que escribirla): ${sinGlobal.length} -> ${sinGlobal.map((x) => x.split(":")[1]).join(", ")}`);
  await p.$disconnect();
})();
