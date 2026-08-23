import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient, Prisma } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmqfnp3tf000032afygkqp8z2";
  const before = await p.journeyStory.findFirst({
    where: { journeyId: J, slug: "kabeljau-vom-fischmarkt" },
    select: { id: true, audioUrl: true, audioFilename: true, audioStatus: true,
              audioSegments: true, audioWordTimings: true, audioFragments: true,
              audioUrlPreview: true, audioFilenamePreview: true },
  });
  if (!before) { console.log("no row"); return; }
  const size = (x: unknown) => (Array.isArray(x) ? `${x.length} elem` : x == null ? "null" : "set");
  console.log("ANTES  url:", before.audioUrl, "| status:", before.audioStatus,
    "| segments:", size(before.audioSegments), "| wordTimings:", size(before.audioWordTimings),
    "| fragments:", size(before.audioFragments), "| filename:", before.audioFilename);
  if (process.argv.includes("--apply")) {
    await p.journeyStory.update({
      where: { id: before.id },
      data: { audioUrl: null, audioFilename: null, audioStatus: "pending",
              audioSegments: Prisma.DbNull, audioWordTimings: Prisma.DbNull, audioFragments: Prisma.DbNull,
              audioUrlPreview: null, audioFilenamePreview: null },
    });
    const after = await p.journeyStory.findUnique({ where: { id: before.id },
      select: { audioUrl: true, audioStatus: true, audioSegments: true, audioWordTimings: true, audioFragments: true } });
    console.log("DESPUES url:", after?.audioUrl, "| status:", after?.audioStatus,
      "| segments:", size(after?.audioSegments), "| wordTimings:", size(after?.audioWordTimings),
      "| fragments:", size(after?.audioFragments));
  }
  await p.$disconnect();
})();
