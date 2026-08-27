import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: process.argv[2], slug: "" } } });
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug: true, title: true, text: true } });
  fs.writeFileSync("scripts/_textos.json", JSON.stringify(Object.fromEntries(ss.map((s) => [s.slug!, `${s.title}. ${s.text}`])), null, 1));
  console.log("historias:", ss.length);
  await p.$disconnect();
})();
