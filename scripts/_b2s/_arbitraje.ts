import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b1";
const DUPS = ["al final", "tocar", "despacio", "explicar", "palabra por palabra"];
const SLUGS = ["la-mayoria-decide-el-techo", "lo-que-corre-por-el-portal", "el-retraso-no-es-suyo", "dos-precios-un-techo", "el-tecnico-habla-rapido", "la-nueva-ya-tiene-mote", "el-horno-y-los-bollos"];
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  for (const slug of SLUGS) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { vocab: true } });
    const g = (filas.find((f) => f.slug === slug)?.glosses ?? {}) as Record<string, any>;
    const v = (h!.vocab as any[]).map((x) => `${x.word}(${x.type[0]}${DUPS.includes(x.word) ? "·DUP" : ""}${g[x.word]?.rev || g[(x.surface ?? "").toLowerCase()]?.rev ? "·rev" : ""})`);
    console.log(slug, "->", v.join(" "));
  }
  await p.$disconnect();
})();
