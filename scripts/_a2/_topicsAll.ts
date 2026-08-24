import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.topic.findMany({ select: { slug: true, label: true } });
  const want = ["baskets-and-errands","rest-and-siesta","hands-and-gestures","vegetables-and-footpaths","pots-and-pans","feelings-and-phone-calls","papers-keys-and-money"];
  const hit = rows.filter((r) => want.includes(r.slug));
  fs.writeFileSync("/tmp/topics.txt",
    `total temas: ${rows.length}\nchoques con los nuevos slugs: ${hit.length ? hit.map(h=>h.slug+" = "+h.label).join(" | ") : "ninguno"}\n` +
    rows.map(r=>r.slug+" = "+r.label).sort().join("\n"));
})().finally(() => p.$disconnect());
