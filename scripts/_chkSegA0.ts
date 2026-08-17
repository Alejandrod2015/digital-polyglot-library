import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: "otra-vez-al-mercado" }, select: { audioSegments: true } });
  const segs = (s?.audioSegments as any[]) || [];
  const hit = null as any;
  console.log("listen fragment:", hit ? `FOUND ${hit.startSec}-${hit.endSec}` : "NOT FOUND");
  for (const g of segs) console.log(JSON.stringify(g.text));
})().finally(() => prisma.$disconnect());
