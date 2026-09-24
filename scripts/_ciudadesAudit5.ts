/** Frases donde aparece cada ciudad candidata, para decidir cual ENMARCA el journey. */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const [id, ...cities] = process.argv.slice(2);
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: id }, select: { topic: true, slotIndex: true, title: true, text: true, synopsis: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  for (const c of cities) {
    console.log(`\n##### ${c}`);
    let n = 0;
    for (const s of st) {
      const blob = [s.synopsis ?? "", s.text ?? ""].join(" ");
      const frases = blob.split(/(?<=[.!?])\s+/).filter(f => new RegExp(`(^|[^\\p{L}])${c}([^\\p{L}]|$)`, "u").test(f));
      if (frases.length) { n++; frases.slice(0, 2).forEach(f => console.log(`  [${s.topic}/${s.slotIndex}] ${f.trim().slice(0, 170)}`)); }
    }
    console.log(`  => ${n} historias`);
  }
  await p.$disconnect();
})();
