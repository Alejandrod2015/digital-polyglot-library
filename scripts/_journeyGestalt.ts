/**
 * Lo que solo se ve leyendo las 21 juntas: primera frase, última frase, momento
 * del día y verbo del gesto final. Ningún gate mira esto. Solo lectura.
 *
 *   npx tsx scripts/_journeyGestalt.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const NOCHE = /\b(nuit|minuit|soir|soirée|tard|onze heures|dix heures|neuf heures|deux heures du matin)\b/i;

async function main() {
  const journeyId = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId, NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, text: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  for (const [i, s] of st.entries()) {
    const t = String(s.text ?? "").trim();
    const first = (t.split(/(?<=[.!?])\s/)[0] ?? "").trim();
    const paras = t.split(/\n{2,}/);
    const lastPara = paras[paras.length - 1] ?? "";
    const sentences = lastPara.split(/(?<=[.!?])\s/).filter(Boolean);
    const last = (sentences[sentences.length - 1] ?? "").trim();
    console.log(`\n[${i + 1}] ${s.title}${NOCHE.test(lastPara) ? "  (cierra de noche)" : ""}`);
    console.log(`   abre:  ${first}`);
    console.log(`   cierra: ${last}`);
  }
  await p.$disconnect();
}
main();
