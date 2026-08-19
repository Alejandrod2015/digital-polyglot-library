import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
async function main() {
  const [out, ...pares] = process.argv.slice(2);
  const rows = [];
  for (const par of pares) {
    const [topic, slot] = par.split("#");
    const r = await p.journeyStory.findFirst({ where: { journeyId: "cmsyrge55000732u9oiu8wue3", topic, slotIndex: Number(slot) } });
    if (r) rows.push({ topic: r.topic, slotIndex: r.slotIndex, title: r.title, arcType: (r as any).arcType, synopsis: (r as any).synopsis, text: r.text, vocab: r.vocab });
  }
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log("dump", rows.length);
  await p.$disconnect();
}
main();
