import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { extractExampleSentence } from "../src/lib/exampleSentence";
const p = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry");
  const favs = await p.favorite.findMany({ select: { id: true, word: true, exampleSentence: true } });
  let updated = 0;
  for (const f of favs) {
    const before = (f.exampleSentence || "").trim();
    if (!before) continue;
    const after = (extractExampleSentence(before, f.word) || "").trim();
    if (after && after !== before) {
      if (!dry) await p.favorite.update({ where: { id: f.id }, data: { exampleSentence: after } });
      updated++;
    }
  }
  console.log(`${dry ? "[DRY] " : ""}favoritos actualizados: ${updated} / ${favs.length}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
