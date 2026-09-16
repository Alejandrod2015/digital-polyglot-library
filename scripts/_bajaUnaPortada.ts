import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: "une-blague-mal-repetee" }, select: { coverUrl:true } });
  const r = await fetch(s.coverUrl);
  writeFileSync("/private/tmp/cover-inbox/vecina.jpg", Buffer.from(await r.arrayBuffer()));
  console.log("bajada:", s.coverUrl);
  await p.$disconnect();
})();
