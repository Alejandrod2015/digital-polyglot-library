/** Solo lectura: imprime historias de un journey (texto, sinopsis, vocab) para leerlas. Uso: _frB1Ver.ts <journeyId> [topic] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; const p = new PrismaClient();
async function main() {
  const [id, topic, modo] = process.argv.slice(2);
  const st = await p.journeyStory.findMany({ where: { journeyId: id, ...(topic ? { topic } : {}) }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true, cast: true } });
  for (const s of st) {
    console.log(`\n=== ${s.topic}#${s.slotIndex} ${s.title} (${s.slug}) arc=${s.arcType}\nSINOPSIS: ${s.synopsis}\n${s.text}`);
    if (modo !== "sinvocab") console.log("VOCAB:", JSON.stringify(s.vocab));
  }
}
main().finally(() => p.$disconnect());
