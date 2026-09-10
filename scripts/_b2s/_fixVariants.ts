/** Arregla los 15 trozos del b2 que gloss-variants marca: trozo exacto del
 *  cuerpo, la palabra clave dentro del trozo, y el ingles sin traducir de mas.
 *  Verifica cada trozo contra el cuerpo REAL antes de escribir. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-latam-b2";
type F = { slug: string; key: string; es?: string; en?: string; borrar?: boolean };
const FIXES: F[] = [
  { slug: "el-vino-equivocado", key: "anillos", es: "atiende con delantal y anillos", en: "serves with apron and rings" },
  { slug: "el-albur-que-llego-tarde", key: "festejar", es: "festejar sería creerse el regalo", en: "celebrating would mean believing the gift" },
  { slug: "la-tanda-quemada", key: "tanda", es: "la primera tanda de milanesas", en: "the first batch of milanesas" },
  { slug: "la-tanda-quemada", key: "rebozar", en: "can you bread, kid" },
  { slug: "sabado-de-franco", key: "tapado", borrar: true },
  { slug: "lo-conversamos", key: "telas", es: "Guarda las telas doblándolas dos veces", en: "puts the fabrics away, folding them twice" },
  { slug: "la-vista-gorda", key: "postular", es: "¿Y vas a postular, al final?", en: "and are you applying, in the end" },
  { slug: "la-vista-gorda", key: "presupuesto", es: "el presupuesto por capas", en: "the quote broken down by coats" },
  { slug: "el-telefono-boca-abajo", key: "estrenar", en: "debuting the phrase" },
  { slug: "el-telefono-boca-abajo", key: "estrenando", en: "debuting the phrase" },
  { slug: "la-pared-que-nadie-encargo", key: "tumba", es: "una semana y casi la tumba", en: "one week and it nearly flattens her" },
  { slug: "la-pared-que-nadie-encargo", key: "tumbar", es: "una semana y casi la tumba", en: "one week and it nearly flattens her" },
  { slug: "la-pared-que-nadie-encargo", key: "secreto", es: "ella guardó el secreto una semana", en: "she kept the secret one week" },
  { slug: "pescados-de-dos-metros", key: "y gracias", en: "and that is generous" },
  { slug: "nadie-falta-nunca", key: "subte", es: "baja los lunes del subte", en: "comes off the underground on Mondays" },
];
(async () => {
  const cuerpos = new Map<string, string>();
  for (const s of await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, text: true } }))
    cuerpos.set(s.slug!, s.text ?? "");
  for (const f of FIXES) {
    const w = { bundle_slug: { bundle: B, slug: f.slug } };
    const fila = await p.tapGlossSet.findUnique({ where: w });
    const g = fila!.glosses as Record<string, any>;
    if (f.borrar) { delete g[f.key]; await p.tapGlossSet.update({ where: w, data: { glosses: g } }); console.log(`borrada ${f.slug}/${f.key}`); continue; }
    if (f.es && !cuerpos.get(f.slug)!.includes(f.es)) throw new Error(`trozo no esta en el cuerpo: ${f.slug} / ${f.es}`);
    const e = g[f.key];
    e.c = { es: f.es ?? e.c.es, en: f.en ?? e.c.en };
    g[f.key] = e;
    await p.tapGlossSet.update({ where: w, data: { glosses: g } });
    console.log(`ok ${f.slug}/${f.key}`);
  }
  await p.$disconnect();
})();
