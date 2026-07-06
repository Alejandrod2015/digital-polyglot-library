import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  await prisma.journey.update({ where: { id: "cmr92f0qz000032ff1dfd4fgx" }, data: { levels: ["c1"] } });
  const r = await prisma.journeyStory.updateMany({ where: { journeyId: "cmr92f0qz000032ff1dfd4fgx" }, data: { level: "c1" } });
  console.log(`journey → c1; ${r.count} historias actualizadas`);
})().finally(() => prisma.$disconnect());
