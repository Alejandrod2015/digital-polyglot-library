import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = "cmt0a8vb1000m32p1x7r5ba28";
const objetivo = ["die Bahn","das Fenster","die Jacke","halten","dunkel","leise","der Laden","die Hütte","draußen","still","laut","weiß","bleiben","ziehen","der Kreis","zählen","kalt","der Wind","herum"];
(async () => {
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { id: true, typeSlug: true, levels: true, status: true, variant: true } } },
  });
  const porJourney: Record<string, { tipo: string; nivel: string; estado: string; hits: string[] }> = {};
  for (const r of otras) {
    const jj = r.journey!;
    const k = jj.id;
    porJourney[k] ??= { tipo: jj.typeSlug ?? "?", nivel: (jj.levels ?? []).join("/"), estado: jj.status, hits: [] };
    for (const v of ((r.vocab as any[]) ?? [])) {
      const w = String(v?.word ?? "");
      if (objetivo.includes(w) && !porJourney[k].hits.includes(w)) porJourney[k].hits.push(w);
    }
  }
  for (const [id, d] of Object.entries(porJourney)) {
    if (!d.hits.length) continue;
    console.log(`${id} tipo=${d.tipo} nivel=${d.nivel} ${d.estado} MISMO_TIPO=${d.tipo === mio!.typeSlug} -> ${d.hits.join(", ")}`);
  }
  await p.$disconnect();
})();
