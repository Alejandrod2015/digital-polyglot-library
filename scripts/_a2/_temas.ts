import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt70xfyt000l3283gxd70wck" }, select: { topics: true } });
  const slugs = (j?.topics as string[]) ?? [];
  const rows = await p.topic.findMany({ where: { slug: { in: slugs } }, select: { slug: true, label: true, isUniversal: true } }).catch(() => [] as any[]);
  fs.writeFileSync("/tmp/temas.txt", slugs.map((s, i) => `${i + 1}. ${s}  ->  ${(rows.find((r: any) => r.slug === s)?.label) ?? "(sin fila)"}`).join("\n") + "\n");
})().finally(() => p.$disconnect());
