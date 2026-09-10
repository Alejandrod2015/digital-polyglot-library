// Solo lectura: plazas del Traveler PT-BR A0 nuevo que las listas PT (A1/A2 + B1) no reconocen,
// con historia, tipo, ancla y definicion, para revisarlas una a una.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
const p = new PrismaClient();
const dentro = (w: string) => isPortugueseA1A2(w) || isPortugueseB1Lemma(w);
const fuera = (w: string) => {
  const x = w.trim().toLowerCase();
  if (!x || x.includes(" ")) return false;
  const f = [x]; if (x.endsWith("es") && x.length > 4) f.push(x.slice(0, -2)); if (x.endsWith("s") && x.length > 3) f.push(x.slice(0, -1));
  return !f.some(dentro);
};
async function main() {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl", NOT: { topic: "bonito" } }, select: { slug: true, topic: true, vocab: true } });
  const t7 = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).map((s: any) => ({ slug: `bonito#${s.slotIndex}`, topic: "bonito", vocab: s.vocab }));
  for (const r of [...rows, ...t7]) for (const v of (r.vocab as any[] ?? []))
    if (fuera(String(v.word))) console.log(`${r.topic}\t${r.slug}\t${v.word}\t${v.type}\t${v.anchor ? "ANCLA" : ""}\t${v.definition}`);
}
main().finally(() => p.$disconnect());
