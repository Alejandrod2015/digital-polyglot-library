import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, text: true }, orderBy: { slug: "asc" },
  });
  for (const s of ss) {
    for (const or of String(s.text).split(/(?<=[.!?"”])\s+/)) {
      if (/\bcerrad[oa]s?\b/i.test(or)) console.log(s.slug.padEnd(30), "|", or.trim());
    }
  }
  await p.$disconnect();
})();
