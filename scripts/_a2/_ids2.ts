import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt70xfyt000l3283gxd70wck", topic: "company-and-long-afternoons" },
    orderBy: { slotIndex: "asc" },
    select: { id: true, slug: true, title: true, text: true },
  });
  fs.writeFileSync("/tmp/t2.txt", ss.map((s) => `### ${s.slug} ${s.id}\n${s.title}\n${s.text}`).join("\n\n"));
})().finally(() => p.$disconnect());
