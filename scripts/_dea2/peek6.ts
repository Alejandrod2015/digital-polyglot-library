import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const casos: Array<[string,string[]]> = [
    ["drei-stunden-transporter", ["zu","dritt","im","treppenhaus"]],
    ["der-besen-im-blumenladen", ["besen","blumenladen","im"]],
  ];
  for (const [slug, ws] of casos) {
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "german-friends-a2", slug } } });
    const g = f!.glosses as Record<string, any>;
    console.log(`== ${slug}`);
    for (const w of ws) {
      const e = g[w];
      console.log(`  ${w.padEnd(13)} g="${e?.g}"  c="${e?.c?.es}"  cs=${(e?.cs??[]).length}`);
    }
  }
  await p.$disconnect();
})();
