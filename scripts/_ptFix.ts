/** Quita o corrige tablas de conjugación que no son de la palabra que sale.
 *  npx tsx scripts/_ptFix.ts */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const B = "portuguese-traveler-brazil-a1";

/** `para` es preposición en estas; una tabla de `parar` ahí miente. */
const QUITA: Array<[string, string]> = [
  ["roupa-que-nao-seca", "para"], ["cambio-na-calculadora", "para"], ["boiada-na-estrada", "para"],
  ["isopor-para-manaus", "para"], ["a-cuia-das-cinco", "para"], ["a-rede-do-conves", "para"],
  ["repelente-na-farmacia", "para"], ["o-jacare-nao-se-move", "para"], ["o-carimbo-que-ninguem-pede", "para"],
  ["o-sino-das-seis", "para"],
  // "Na volta" es el sustantivo, no el verbo.
  ["o-jacare-nao-se-move", "volta"],
  // chover es impersonal: "chovo" y "chovemos" no los dice nadie.
  ["a-vara-e-a-isca", "chove"],
];

/** `ri` sale en presente en las cuatro, y la tabla decía pretérito. */
const RI = ["cera-nas-dunas", "boiada-na-estrada", "a-vara-e-a-isca", "o-sino-das-seis"];
const RI_ROWS = [["eu","rio"],["você, ele, ela","ri"],["a gente","ri"],["nós","rimos"],["vocês","riem"],["eles, elas","riem"]];

async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const por = new Map(filas.map((f) => [f.slug, f.glosses as Record<string, any>]));
  let quitadas = 0, arregladas = 0;
  for (const [slug, w] of QUITA) {
    const e = por.get(slug)?.[w];
    if (!e?.f) { console.error(`sin tabla: ${slug} / ${w}`); process.exit(1); }
    delete e.f; quitadas++;
  }
  for (const slug of RI) {
    const e = por.get(slug)?.["ri"];
    if (!e?.f) { console.error(`sin tabla: ${slug} / ri`); process.exit(1); }
    e.f = { kind: "expand", link: "See conjugation", lemma: "rir", rows: RI_ROWS, here: 1 };
    arregladas++;
  }
  for (const [slug, glosas] of por) {
    if (slug === "") continue;
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: glosas as never } });
  }
  console.log(`${quitadas} tablas quitadas, ${arregladas} corregidas`);
  await p.$disconnect();
}
main();
