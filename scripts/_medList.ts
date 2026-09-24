import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const LANG: Record<string,string> = { spanish:"ES", german:"DE", french:"FR", italian:"IT", portuguese:"PT", polish:"PL", korean:"KO", arabic:"AR" };
(async () => {
  const js = await p.journey.findMany({ where: { status: "draft" }, select: { id: true, language: true, levels: true, variant: true } });
  for (const j of js) console.log([j.id, LANG[j.language] ?? j.language, (j.levels ?? [])[0] ?? "", (j.variant ?? "").toUpperCase()].join("|"));
})().finally(() => p.$disconnect());
