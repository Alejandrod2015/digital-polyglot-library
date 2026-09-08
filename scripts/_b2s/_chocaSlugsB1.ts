import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
import { globSync } from "glob";
const p = new PrismaClient();
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
(async () => {
  const nuevos: string[] = [];
  for (const f of globSync("scripts/_b2s/retit/b1-t*.json").filter((x) => !x.endsWith(".plan.json")).sort())
    for (const s of JSON.parse(readFileSync(f, "utf8"))) nuevos.push(slugify(s.title));
  if (new Set(nuevos).size !== 21) console.log("DUP INTERNO");
  const js = await p.journeyStory.findMany({ where: { slug: { in: nuevos } }, select: { slug: true, journeyId: true } });
  const gs = await p.tapGlossSet.findMany({ where: { slug: { in: nuevos } }, select: { bundle: true, slug: true } });
  console.log(nuevos.join("\n"));
  console.log(js.length || gs.length ? `CHOQUES: ${JSON.stringify({ js, gs })}` : "cero choques en journeyStory y tapGlossSet");
  await p.$disconnect();
})();
