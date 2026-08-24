import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3" }, select: { slug: true, audioUrl: true, audioWordTimings: true, audioSegments: true, audioFragments: true } });
  const sucias = r.filter((s) => s.audioWordTimings || s.audioSegments || s.audioFragments || s.audioUrl);
  console.log(sucias.length ? sucias.map((s) => s.slug).join(", ") : "ninguna historia arrastra restos de audio");
  await p.$disconnect();
})();
