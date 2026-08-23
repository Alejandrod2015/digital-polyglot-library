import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { id: true, audioUrl: true, audioFragments: true } });
  if (!s) { console.log("no existe"); await p.$disconnect(); return; }
  const n = Array.isArray(s.audioFragments) ? s.audioFragments.length : 0;
  await p.journeyStory.update({ where: { id: s.id }, data: { audioFragments: undefined, audioSegments: undefined, audioWordTimings: undefined, audioStatus: "pending" } });
  console.log(`fragmentos retirados: ${n} · audioUrl ${s.audioUrl ?? "null"}`);
  await p.$disconnect();
})();
