import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { journeyId: "cmtmylg7k0007321h6t7njesx", slug: "le-puso-el-ojo-al-cuartel" }, select: { vocab: true } });
  console.log(JSON.stringify((s?.vocab as any[])?.slice(0, 6), null, 1));
  await p.$disconnect();
})();
