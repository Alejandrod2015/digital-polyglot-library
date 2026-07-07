import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const STELLA = "ebRwkdEFVZIx2A6YucFh"; // narradora A0 FR aprobada 2026-07-07
(async () => {
  const r = await prisma.journeyStory.updateMany({
    where: { journeyId: "cmraj8ihq000032a6sghnrim9" },
    data: { voiceId: STELLA },
  });
  console.log(`voiceId=Stella en ${r.count} historias`);
})().finally(() => prisma.$disconnect());
