import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b1";
const CASOS: [string, string][] = [
  ["la-fecha-que-decide", "cortarse"], ["la-fecha-que-decide", "oírse"],
  ["el-piloto-azul", "girarse"], ["a-ver-si-te-sigo", "perderse"],
  ["lo-de-chispa", "enterarse"], ["mira-la-apuntadora", "pararse"],
  ["el-tejado-a-la-mitad", "apoyarse"], ["lo-pongo-por-escrito", "tocarse"],
  ["lo-pongo-por-escrito", "encima de"], ["poco-y-de-oidas", "encogerse"],
  ["poco-y-de-oidas", "acordarse"], ["palabra-por-palabra", "acabarse"],
  ["palabra-por-palabra", "debajo de"], ["la-voz-mas-rapida", "todavía no"],
];
(async () => {
  for (const [slug, lema] of CASOS) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { vocab: true } });
    const v = (h!.vocab as any[]).find((x) => x.word === lema);
    const sup = String(v?.surface ?? "").toLowerCase();
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = fila!.glosses as Record<string, any>;
    const e = sup ? g[sup] : undefined;
    console.log(`${slug.padEnd(22)} ${lema.padEnd(12)} sup="${sup}" clave_sup=${e ? (e.c ? "con capa" : "SIN c") : "NO EXISTE"}`);
  }
  await p.$disconnect();
})();
