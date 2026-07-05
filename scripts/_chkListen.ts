import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const exs = JSON.parse(readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
  const l = exs.find((e: any) => e.type === "listen_choose");
  if (!l) { console.log("no listen"); return; }
  const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { audioSegments: true } });
  const segs = (s?.audioSegments as any[]) || [];
  const hit = segs.find((g) => g.text.trim() === l.sentence.trim());
  console.log(hit ? `listen OK (${hit.startSec}-${hit.endSec})` : "listen NOT FOUND; segments containing target:");
  if (!hit) for (const g of segs) if (g.text.includes(l.payload.answer)) console.log("  ", JSON.stringify(g.text));
})().finally(() => prisma.$disconnect());
