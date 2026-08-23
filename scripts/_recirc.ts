import { PrismaClient } from "../src/generated/prisma";
import fs from "fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ topic: string; slotIndex: number; text: string; vocab: Array<{ word: string; anchor?: boolean }> }>;
  d.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  console.log("ORDEN: " + orden.join(" > "));
  const flojas: string[] = [];
  d.forEach((s, i) => {
    for (const v of s.vocab) {
      if (v.anchor) continue;
      const re = new RegExp(v.word.slice(0, Math.max(4, v.word.length - 2)), "i");
      let enc = 1;
      for (let k = i + 1; k < d.length; k++) if (re.test(d[k].text)) enc++;
      if (enc < 2) flojas.push(`${i}:${v.word}`);
    }
  });
  console.log(`SIN RETORNO (${flojas.length}): ` + flojas.join(" "));
  await p.$disconnect();
})();
