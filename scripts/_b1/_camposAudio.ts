import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmsvz6mz9000732gsgsfer0ko" },
    select: { slug: true, audioSegments: true, audioFragments: true, audioWordTimings: true },
    take: 3,
  });
  for (const s of ss) {
    const n = (x: any) => (Array.isArray(x) ? x.length : x == null ? "null" : typeof x);
    console.log(s.slug.padEnd(32), "segments:", n(s.audioSegments), "fragments:", n(s.audioFragments), "wordTimings:", n(s.audioWordTimings));
  }
  await p.$disconnect();
})();
