import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const ids: [string, string][] = [["A0 Spain","cmrr5hnbl000032k1esry5n8g"],["A1 Spain","cmsvz6mz9000732gsgsfer0ko"],["B1 Spain","cmt5x67ze000l320cpgunu5vi"]];
  const out: string[] = [];
  for (const [n, id] of ids) {
    const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
    const slugs = (j?.topics as string[]) ?? [];
    const rows = await p.topic.findMany({ where: { slug: { in: slugs } }, select: { slug: true, label: true } });
    out.push(`${n}: ` + slugs.map((s) => rows.find((r) => r.slug === s)?.label ?? s).join(" · "));
  }
  fs.writeFileSync("/tmp/vecinos.txt", out.join("\n\n") + "\n");
})().finally(() => p.$disconnect());
