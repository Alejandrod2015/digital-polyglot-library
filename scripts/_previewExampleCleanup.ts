import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { extractExampleSentence } from "../src/lib/exampleSentence";
const p = new PrismaClient();

async function main() {
  const favs = await p.favorite.findMany({ select: { word: true, exampleSentence: true } });
  let changed = 0, unchanged = 0, kept = 0;
  const samples: string[] = [], broken: string[] = [];
  for (const f of favs) {
    const before = (f.exampleSentence || "").trim();
    if (!before) { unchanged++; continue; }
    const after = (extractExampleSentence(before, f.word) || "").trim();
    if (after !== before) {
      changed++;
      const w = (f.word || "").toLowerCase().replace(/\[\[|\]\]/g, "");
      const cleanStart = /^[„«"'“¿¡A-Za-zÀ-ÿ0-9]/.test(after);
      if (after.toLowerCase().includes(w) && cleanStart) kept++;
      else broken.push(`${f.word}: ${after.slice(0, 80)}`);
      if (samples.length < 10) samples.push(`• ${f.word}\n    A: ${before.slice(0, 88)}\n    D: ${after.slice(0, 88)}`);
    } else unchanged++;
  }
  console.log(`CAMBIAN: ${changed} | sin cambio: ${unchanged} | limpios: ${kept} | posibles rotos: ${broken.length}`);
  if (broken.length) { console.log("\nROTOS/DUDOSOS:"); broken.forEach((b) => console.log("   !", b)); }
  console.log("\nMUESTRAS:"); console.log(samples.join("\n"));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
