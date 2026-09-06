/** El genero de cada sustantivo sale del ARTICULO que lleva pegado en el texto
 *  real, que es la misma regla de buildGlossForms. Sin articulo delante no se
 *  inventa: se queda sin marca, que es mejor que ponerla mal. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const M = new Set(["el", "los", "un", "unos", "del", "al", "este", "ese", "otro"]);
const F = new Set(["la", "las", "una", "unas", "esta", "esa", "otra"]);
(async () => {
  const p = new PrismaClient();
  const textos = JSON.parse(fs.readFileSync("scripts/_b1/g/textos.json", "utf8")) as Record<string, string>;
  for (const [slug, texto] of Object.entries(textos)) {
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug } } });
    if (!f) continue;
    const g = f.glosses as Record<string, any>;
    const tok = texto.toLowerCase().match(/[\p{L}]+/gu) ?? [];
    let n = 0, sin: string[] = [];
    for (const [w, e] of Object.entries(g)) {
      if (e.t !== "noun" || e.gm) continue;
      let marca = "";
      for (let i = 1; i < tok.length; i++) {
        if (tok[i] !== w) continue;
        const a = tok[i - 1];
        if (M.has(a)) { marca = "m."; break; }
        if (F.has(a)) { marca = "f."; break; }
      }
      if (marca) { e.gm = marca; n++; } else sin.push(w);
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug } }, data: { glosses: g } });
    console.log(`${slug.padEnd(28)} ${n} con genero · sin articulo delante: ${sin.join(", ") || "-"}`);
  }
  await p.$disconnect();
})();
