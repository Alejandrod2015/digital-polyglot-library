import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  fs.writeFileSync(process.argv[3], JSON.stringify(st, null, 2));
  console.log(`escritas ${st.length} historias en ${process.argv[3]}`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
