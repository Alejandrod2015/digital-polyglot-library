import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { audioSegments: true, audioFragments: true } });
  console.log("segmento ejemplo:", JSON.stringify((s.audioSegments as any[])?.[0]));
  console.log("fragmento ejemplo:", JSON.stringify((s.audioFragments as any[])?.[0])?.slice(0, 300));
  console.log("n segmentos:", (s.audioSegments as any[])?.length, "n fragmentos:", (s.audioFragments as any[])?.length);
  await p.$disconnect();
})();
