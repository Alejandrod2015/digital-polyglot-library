import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const j = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3" }, select: { topic: true, slotIndex: true, title: true, coverUrl: true } });
  let con = 0;
  for (const t of j?.topics ?? []) for (const r of rows.filter((x) => x.topic === t).sort((a, b) => a.slotIndex - b.slotIndex)) {
    if (r.coverUrl) con++;
    console.log(`${r.coverUrl ? "SI " : "NO "} ${t} #${r.slotIndex + 1} ${r.title}`);
  }
  console.log(`\nportadas: ${con}/${rows.length}`);
  await p.$disconnect();
}
main();
