// Inventario read-only: ejercicios es/de con audio renderizado.
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.storyPracticeExercise.findMany({
    where: { audioUrl: { not: null }, language: { in: ["spanish", "german"] } },
    select: { id: true, language: true, word: true, sentence: true, audioText: true, audioUrl: true, audioVoiceId: true,
      set: { select: { story: { select: { slug: true } } } } },
  });
  const out = rows.map((r) => ({ id: r.id, lang: r.language === "german" ? "de" : "es", word: r.word,
    text: r.audioText || r.sentence, url: r.audioUrl!, voice: r.audioVoiceId, slug: r.set?.story?.slug }));
  writeFileSync("scripts/_qa_audit_inventory.json", JSON.stringify(out, null, 1));
  const by: Record<string, number> = {};
  for (const o of out) by[`${o.lang} | ${o.url.split("/").slice(3, -1).join("/")} | voice=${o.voice ? "sí" : "no"}`] ??= 0, by[`${o.lang} | ${o.url.split("/").slice(3, -1).join("/")} | voice=${o.voice ? "sí" : "no"}`]++;
  console.log(`total: ${out.length}`);
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);
  const holes = out.filter((o) => o.text.includes("____")).length;
  console.log(`textos con blanco (____): ${holes}`);
  await prisma.$disconnect();
})();
