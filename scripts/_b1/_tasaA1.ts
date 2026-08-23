import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmsvz6mz9000732gsgsfer0ko" },
    select: { slug: true, text: true, title: true, audioFragments: true },
  });
  let tw = 0, tt = 0;
  for (const s of ss) {
    const fr: any = s.audioFragments;
    if (!Array.isArray(fr) || !fr.length) { console.log("sin fragments:", s.slug); continue; }
    const habla = fr.reduce((a: number, f: any) => a + (f.endSec - f.startSec), 0);
    const pal = (s.title + " " + s.text).trim().split(/\s+/).length;
    tw += pal; tt += habla;
    console.log(s.slug.padEnd(34), pal, habla.toFixed(1), (pal / habla).toFixed(2));
  }
  console.log("\nTASA MEDIA A1 spain:", (tw / tt).toFixed(3), "pal/s de habla");
  await p.$disconnect();
})();
