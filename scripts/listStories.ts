import "dotenv/config";
import * as dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const prisma = new PrismaClient();
  const known = ["cmpqkibj70001326n3vpbzwvj", "cmpr20r56000132b8a7pqugsv"];
  const stories = await prisma.journeyStory.findMany({
    where: { journey: { id: { in: (await prisma.journeyStory.findMany({ where: { id: { in: known } }, select: { journeyId: true } })).map((s) => s.journeyId) } } },
    include: { journey: { select: { name: true } } },
    orderBy: { slotIndex: "asc" },
  });
  for (const s of stories) {
    console.log(`slot=${s.slotIndex ?? "?"} | ${s.id} | "${s.title}" | level=${s.level} topic=${s.topic} status=${s.status} | text=${(s.text || "").length}ch coverDone=${s.coverDone} audioStatus=${s.audioStatus} | journey="${s.journey.name}"`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
