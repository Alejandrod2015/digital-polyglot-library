import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt70xfyt000l3283gxd70wck" }, select: { status: true, language: true, variant: true, name: true, level: true } });
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt70xfyt000l3283gxd70wck" }, select: { status: true, audioUrl: true, coverUrl: true } });
  fs.writeFileSync("/tmp/final.txt",
    `journey: ${j?.name} ${j?.language}/${j?.variant} ${JSON.stringify(j?.level)} -> ${j?.status}\n` +
    `publicadas: ${ss.filter(s => s.status === "published").length}/${ss.length} · audio ${ss.filter(s => s.audioUrl).length} · portada ${ss.filter(s => s.coverUrl).length}\n`);
})().finally(() => p.$disconnect());
