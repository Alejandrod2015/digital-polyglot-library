/** Solo lectura: vuelca las 21 historias del Friends FR A2 en orden de lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; const p = new PrismaClient();
async function main() { const j = await p.journey.findUnique({ where: { id: "cmu04ereh000732z7px7naqa2" }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmu04ereh000732z7px7naqa2" }, select: { topic: true, slotIndex: true, title: true, text: true, synopsis: true } });
  rows.sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  for (const r of rows) console.log(`## ${r.topic} ${r.slotIndex} | ${r.title}\nSINOPSIS: ${r.synopsis}\n${r.text}\n`); await p.$disconnect(); }
main();
