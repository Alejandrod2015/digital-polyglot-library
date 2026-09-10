import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: process.argv[2] }, select: { topic: true, slotIndex: true, title: true, arcType: true, synopsis: true, text: true, vocab: true } });
  const porTema: Record<string, any[]> = {};
  for (const r of rows) (porTema[r.topic!] ??= []).push({ ...r, slotIndex: Number(r.slotIndex) });
  for (const [t, l] of Object.entries(porTema)) writeFileSync(`${process.argv[3]}/dry-${t}.json`, JSON.stringify(l.sort((a, b) => Number(a.slotIndex) - Number(b.slotIndex)), null, 1));
  console.log(Object.keys(porTema).length, "temas volcados");
  await p.$disconnect();
})();
