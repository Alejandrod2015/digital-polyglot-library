import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.groupBy({ by: ["arcType"], _count: true });
  console.log("ARCOS: " + r.map((x) => `${x.arcType} (${x._count})`).join(" · "));
  await p.$disconnect();
})();
