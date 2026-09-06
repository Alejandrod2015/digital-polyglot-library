import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
// Palabras que solo existen en un pueblo de costa o en la comunidad de vecinos.
const PUEBLO = /^(levante|malec[óo]n|alga|barca|lancha|muelle|marea|contraventana|farola|embarcadero|red|sardina|boga|pesca|puerto|chubasco|grava|lodo|manguera|papelera|contenedor|desag[üu]e|terrado|azotea|rellano|portal|cuota|junta|vecindad|panader[íi]a|bollo|levadura|molde|horno|aceituna|campo|huerto|cebolla|semilla|cesta|canasto)$/i;
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, topic: true, vocab: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  let fuera = 0, total = 0;
  for (const s of ss) {
    const v = (s.vocab as Array<{ word: string }>) ?? [];
    total += v.length;
    const malas = v.filter((x) => PUEBLO.test(x.word));
    if (malas.length) { fuera += malas.length; console.log(`${s.slug.padEnd(30)} ${malas.map((m) => m.word).join(", ")}`); }
  }
  console.log(`\nplazas: ${total} · atadas al pueblo o al mar: ${fuera} · reutilizables: ${total - fuera}`);
  await p.$disconnect();
})();
