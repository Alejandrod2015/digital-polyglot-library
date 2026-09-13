/** Solo lectura: recuento de repeticiones del pase de edicion del Friends FR A2 sobre los cuerpos guardados. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; import { isFrenchA1A2 } from "../src/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const PAT: Array<[string, RegExp]> = [
  ["Justine, une prof", /Justine, une prof/g], ["Romain, le copain de Justine", /Romain, le copain de Justine/g],
  ["un électricien de Strasbourg", /un électricien de Strasbourg/g], ["pour la première fois", /pour la première fois/gi],
  ["ça sent", /ça sent/gi], ["Pardon", /Pardon/g], ["les mains sales/noires", /les mains (sales|noires)/g],
  ["comprend trop tard", /comprend trop tard/gi],
];
async function main() {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmu04ereh000732z7px7naqa2" }, select: { topic: true, slotIndex: true, text: true, synopsis: true, vocab: true } });
  for (const [n, re] of PAT) { const hist = rows.filter((r) => (r.text ?? "").match(re)).length; const tot = rows.reduce((a, r) => a + ((r.text ?? "").match(re)?.length ?? 0), 0); console.log(`${n}: ${tot} veces en ${hist} cuerpos`); }
  const fuera = rows.flatMap((r) => ((r.vocab as any[]) ?? []).filter((v) => v.type !== "expression" && !["cultural", "slang", "vulgar"].includes(v.register) && !isFrenchA1A2(v.word)).map((v) => `${r.topic.split("-")[0]}#${r.slotIndex}:${v.word}`));
  console.log(`plazas fuera de la lista actual (sin expresiones ni culturales): ${fuera.length}\n  ${fuera.join(", ")}`);
  const syn = rows.filter((r) => /sans que|quel que|quelle que|ce que ça va|comprend trop tard|qu'il (voie|soit|fasse|puisse)/i.test(r.synopsis ?? "")).map((r) => `${r.topic}#${r.slotIndex}`);
  console.log(`sinopsis con subjuntivo/B1/formula: ${syn.length} ${syn.join(", ")}`);
  await p.$disconnect();
}
main();
