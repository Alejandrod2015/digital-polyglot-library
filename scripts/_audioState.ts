import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows: any[] = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { slug: true, audioUrl: true, audioWordTimings: true, coverUrl: true, status: true },
  });
  const sinAudio = rows.filter((r) => !r.audioUrl).map((r) => r.slug);
  const sinTim = rows.filter((r) => !r.audioWordTimings).map((r) => r.slug);
  const sinCover = rows.filter((r) => !r.coverUrl).map((r) => r.slug);
  console.log("sin audio:", sinAudio.length, sinAudio.join(","));
  console.log("sin timings:", sinTim.length, sinTim.join(","));
  console.log("sin portada:", sinCover.length, sinCover.join(","));
  console.log("status:", [...new Set(rows.map((r) => r.status))].join(","));
  await p.$disconnect();
})();
