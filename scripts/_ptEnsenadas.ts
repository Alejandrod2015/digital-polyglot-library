import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journey: { language: "portuguese" } }, select: { vocab: true } });
  const s = new Set<string>();
  for (const r of st) for (const v of (r.vocab ?? []) as Array<{ word: string }>) s.add(String(v.word).toLowerCase());
  fs.writeFileSync(process.argv[2], JSON.stringify([...s].sort()));
  console.log(s.size, "palabras ya ensenadas en portugues ->", process.argv[2]);
})().finally(() => p.$disconnect());
