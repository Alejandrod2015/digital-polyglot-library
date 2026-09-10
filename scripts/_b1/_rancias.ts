// Scratch: con los textos NUEVOS de los JSON de guardado, lista las entradas de la capa
// cuyo trozo ya no esta en el texto (sin distinguir mayusculas) y las palabras que el
// texto nuevo trae y el viejo no, con su glosa global. Solo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-spain-b1";
const J = "cmt5x67ze000l320cpgunu5vi";
const pal = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
(async () => {
  const p = new PrismaClient();
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, { g: string; t: string; rev?: boolean }>;
  for (const f of process.argv.slice(2)) {
    for (const s of JSON.parse(fs.readFileSync(f, "utf8")) as Array<{ slug: string; text: string }>) {
      const viejo = (await p.journeyStory.findFirst({ where: { journeyId: J, slug: s.slug }, select: { text: true } }))!.text ?? "";
      const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: s.slug } } });
      const g = (fila?.glosses ?? {}) as Record<string, { c?: { es: string; en: string } }>;
      const tx = s.text.toLowerCase();
      console.log(`== ${s.slug}`);
      for (const [w, v] of Object.entries(g)) {
        if (v?.c?.es && !tx.includes(v.c.es.toLowerCase())) console.log(`   RANCIA ${w}: "${v.c.es}" = ${v.c.en}`);
      }
      const antes = pal(viejo);
      for (const w of pal(s.text)) {
        if (antes.has(w) && g[w]) continue;
        const gl = glob[w];
        console.log(`   NUEVA ${w}: ${gl ? `${gl.g} [${gl.t}]${gl.rev ? "" : " rev:false"}` : "SIN GLOSA GLOBAL"}${g[w] ? " (ya en capa)" : ""}`);
      }
    }
  }
  await p.$disconnect();
})();
