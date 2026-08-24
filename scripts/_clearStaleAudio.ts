import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient, Prisma } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { id: true, audioUrl: true } });
  if (!s?.audioUrl) { console.log("sin audio, nada que limpiar"); await p.$disconnect(); return; }
  await p.journeyStory.update({ where: { id: s.id }, data: {
    audioUrl: null, audioFilename: null, audioSegments: Prisma.DbNull, audioFragments: Prisma.DbNull,
    audioWordTimings: Prisma.DbNull, audioStatus: "pending", audioQaStatus: null, audioQaScore: null, audioQaNotes: null } });
  console.log("audio desfasado retirado de", process.argv[2]);
  await p.$disconnect();
}
main();
