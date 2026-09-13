import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { assertLadderContiguous } from "../src/lib/journeyLadder";
const prisma = new PrismaClient();
(async () => {
  const ex = await prisma.journey.findMany({ select: { name: true, language: true, variant: true, levels: true, status: true } });
  try { assertLadderContiguous({ name: "Friends", language: "german", variant: "germany", levels: ["a0"] }, ex as any); console.log("LADDER OK"); }
  catch (e: any) { console.log(e.message); }
  await prisma.$disconnect();
})();
