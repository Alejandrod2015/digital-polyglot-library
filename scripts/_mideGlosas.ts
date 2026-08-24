import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  const formas = new Set<string>();
  for (const s of rows) {
    const txt = `${s.title}\n\n${extractStoryPlainText(s.text)}`;
    for (const m of txt.toLowerCase().matchAll(/\p{L}+(?:-\p{L}+)*/gu)) formas.add(m[0]);
  }
  const a0 = JSON.parse(fs.readFileSync("src/data/tapGlosses/portuguese-traveler-brazil-a0.json", "utf8")) as { glosses: Record<string, unknown> };
  const enA0 = [...formas].filter((f) => a0.glosses[f]);
  const faltan = [...formas].filter((f) => !a0.glosses[f]).sort();
  console.log(`formas distintas en las 21: ${formas.size}`);
  console.log(`ya glosadas en el A0 hermano (copiables, HAY QUE RELEERLAS): ${enA0.length}`);
  console.log(`sin glosa en ninguna parte (a mano): ${faltan.length}`);
  console.log(faltan.join(" "));
  await p.$disconnect();
})();
