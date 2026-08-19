import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
async function main() {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3", slotIndex: 2 }, orderBy: { topic: "asc" } });
  writeFileSync(process.argv[2], JSON.stringify(rows.map((r) => ({ topic: r.topic, slotIndex: r.slotIndex, title: r.title, arcType: (r as any).arcType, synopsis: (r as any).synopsis, text: r.text, vocab: r.vocab })), null, 1));
  for (const r of rows) console.log(`### ${r.topic} ${r.title}\n${r.text}\nVOCAB: ${((r.vocab as any[]) ?? []).map((v) => v.word + "/" + v.surface).join(", ")}\n`);
  await p.$disconnect();
}
main();
