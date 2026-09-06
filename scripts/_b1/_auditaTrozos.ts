/** Los trozos de contexto de mis 21, contra la especificacion nueva:
 *  subcadena literal de su oracion, contiene la palabra, tope blando 5 y
 *  duro 8, y c.en traduce el trozo, no la oracion. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!;
  const ss = await p.journeyStory.findMany({ where: { slug: { in: global.slugs } }, select: { slug: true, title: true, text: true } });
  const texto = new Map(ss.map((s) => [s.slug!, `${s.title}. ${s.text}`]));
  let tot = 0, noSub = 0, sinPal = 0, sobre5 = 0, sobre8 = 0, enLargo = 0;
  const ej: string[] = [];
  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug); if (!t) continue;
    const oraciones = t.split(/(?<=[.?!”])\s+/).map(norm);
    for (const [w, v] of Object.entries(f.glosses as Record<string, any>)) {
      const c = v?.c; if (!c?.es) continue;
      tot++;
      const es = norm(c.es), pal = norm(w);
      const nPal = es.split(" ").length;
      if (!oraciones.some((o) => o.includes(es))) { noSub++; if (ej.length < 6) ej.push(`no es subcadena · ${f.slug} · ${w}: "${c.es}"`); }
      if (!es.includes(pal) && pal.split(" ").length === 1) { sinPal++; if (ej.length < 6) ej.push(`sin la palabra · ${f.slug} · ${w}: "${c.es}"`); }
      if (nPal > 8) sobre8++;
      else if (nPal > 5) sobre5++;
      // c.en no debe ser mas largo que el trozo mas un margen: proxy de "traduce la oracion"
      const nEn = norm(c.en ?? "").split(" ").length;
      if (nEn > nPal + 3) { enLargo++; if (ej.length < 6) ej.push(`ingles largo · ${f.slug} · ${w}: "${c.es}" -> "${c.en}"`); }
    }
  }
  console.log(`trozos ${tot}`);
  console.log(`  no son subcadena de su oracion   ${noSub}`);
  console.log(`  no contienen su palabra          ${sinPal}`);
  console.log(`  de mas de 8 palabras (duro)      ${sobre8}`);
  console.log(`  de 6 a 8 palabras (aviso)        ${sobre5}`);
  console.log(`  ingles mas largo que el trozo+3  ${enLargo}`);
  for (const e of ej) console.log("   " + e);
  await p.$disconnect();
})();
