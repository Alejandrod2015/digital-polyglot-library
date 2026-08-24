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
    where: { journeyId: "cmt70xfyt000l3283gxd70wck" },
    select: { title: true, topic: true, slotIndex: true, coverUrl: true },
  });
  ss.sort((a, b) => orden.indexOf(a.topic!) - orden.indexOf(b.topic!) || (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
  const l = ss.map((s, i) => `${i + 1}\t${s.topic}\t${s.title}\t${s.coverUrl ? "si" : "NO"}`);
  fs.writeFileSync("/tmp/cov.txt", l.join("\n") + `\n\ncon portada: ${ss.filter(s => s.coverUrl).length}/${ss.length}\n`);
})().finally(() => p.$disconnect());
