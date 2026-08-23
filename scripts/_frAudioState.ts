import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { slug: true, audioUrl: true, audioStatus: true, audioQaStatus: true, audioQaScore: true, audioSegments: true, audioWordTimings: true } });
  console.log(JSON.stringify({ slug: s.slug, status: s.audioStatus, qa: s.audioQaStatus, score: s.audioQaScore,
    segmentos: (s.audioSegments as any[])?.length ?? 0, palabrasAlineadas: (s.audioWordTimings as any[])?.length ?? 0, url: s.audioUrl }, null, 1));
  await p.$disconnect();
})();
