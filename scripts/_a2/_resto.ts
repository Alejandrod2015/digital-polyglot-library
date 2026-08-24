import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt70xfyt000l3283gxd70wck" }, select: { topics: true } });
  const orden = (j?.topics as string[]) ?? [];
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt70xfyt000l3283gxd70wck", coverUrl: null },
    select: { id: true, slug: true, title: true, topic: true, slotIndex: true, text: true },
  });
  ss.sort((a, b) => orden.indexOf(a.topic!) - orden.indexOf(b.topic!) || (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
  fs.writeFileSync("/tmp/resto.txt", ss.map((s) => `### ${s.slug} ${s.id} [${s.topic}]\n${s.title}\n${s.text}`).join("\n\n"));
  fs.writeFileSync("/tmp/resto-ids.txt", ss.map((s) => `${s.slug} ${s.id}`).join("\n"));
})().finally(() => p.$disconnect());
