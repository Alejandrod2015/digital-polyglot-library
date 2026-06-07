import "dotenv/config";
import * as dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const prisma = new PrismaClient();
  const journeyId = "cmovi4cvi000032q37a4823h3";
  const created = await prisma.journeyStory.create({
    data: {
      journeyId,
      level: "a1",
      topic: "home-family",
      slotIndex: 18,
      status: "draft",
    },
    select: { id: true, slotIndex: true, level: true, topic: true, status: true },
  });
  console.log(JSON.stringify(created, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
