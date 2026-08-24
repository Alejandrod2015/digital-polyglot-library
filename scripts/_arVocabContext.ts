/**
 * Vuelca las 420 plazas de vocab del A0 argentino con su definicion curada AL
 * LADO de la frase donde aparecen. Es el otro camino del lector: al tocar una
 * `.vocab-word` manda esta definicion, no el bundle de glosas.
 *
 * Solo lee. La regla que audita es la misma del contrato de glosas: la
 * definicion se escribe mirando la frase, no el diccionario.
 *
 *   npx tsx scripts/_arVocabContext.ts [--story=<slug>]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY = "cmt5vx8du000732fjgkwi59ks";
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

(async () => {
  const prisma = new PrismaClient();
  const historias = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  await prisma.$disconnect();
  const solo = arg("story");
  let n = 0;
  for (const h of historias) {
    if (solo && h.slug !== solo) continue;
    console.log(`\n### ${h.slug}`);
    const frases = `${h.title}. ${h.text}`.split(/(?<=[.!?”])\s+/).map((f) => f.trim());
    for (const v of (h.vocab as { word: string; type: string; definition: string }[] ?? [])) {
      n++;
      const rx = new RegExp(`(?<![a-zá-úñ])${v.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-zá-úñ])`, "i");
      const f = frases.find((x) => rx.test(x)) ?? "(no aparece)";
      console.log(`${v.word.padEnd(15)} ${(v.type ?? "").padEnd(11)} ${v.definition}`);
      console.log(`   ${f.slice(0, 100)}`);
    }
  }
  console.log(`\ntotal plazas: ${n}`);
})().catch((e) => { console.error(e); process.exit(1); });
