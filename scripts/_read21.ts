import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const j = await p.journey.findUnique({ where: { id: process.argv[2] }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: process.argv[2] }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  for (const t of j?.topics ?? []) for (const r of rows.filter((x) => x.topic === t)) {
    console.log(`\n===== ${t} #${r.slotIndex + 1} · ${r.title}`);
    console.log(r.text);
  }
  await p.$disconnect();
}
main();
