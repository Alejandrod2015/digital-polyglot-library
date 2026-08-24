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
    select: { topic: true, slotIndex: true, title: true, vocab: true },
  });
  const out: string[] = [];
  for (const t of orden) {
    const rows = ss.filter((s) => s.topic === t).sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));
    const words = rows.flatMap((r) => ((r.vocab as any[]) ?? []).map((v) => String(v.word)));
    out.push(`## ${t}  [${rows.map((r) => r.title).join(" | ")}]`);
    out.push(words.join(", "));
    out.push("");
  }
  fs.writeFileSync("/tmp/vocabtema.txt", out.join("\n"));
})().finally(() => p.$disconnect());
