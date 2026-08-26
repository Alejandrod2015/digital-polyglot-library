import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: b, slug: "" } } });
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug: true, title: true, text: true } });
  const out: Record<string, string> = {};
  for (const s of ss) out[s.slug!] = `${s.title}. ${s.text}`;
  fs.writeFileSync("scripts/_textos.json", JSON.stringify(out, null, 1));
  console.log("historias:", Object.keys(out).length);
  await p.$disconnect();
})();
