import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3", audioUrl: { not: null } }, select: { slug: true, audioQaStatus: true, audioQaScore: true, audioQaNotes: true } });
  for (const s of r) console.log(`${(s.slug ?? "").padEnd(24)} qa=${s.audioQaStatus ?? "null"} score=${s.audioQaScore ?? "-"} ${s.audioQaNotes ? s.audioQaNotes.slice(0, 60) : ""}`);
  await p.$disconnect();
})();
