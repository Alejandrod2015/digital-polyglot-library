/** Solo lectura: lemas de la lista FR A1/A2 que no ensena ningun journey frances y que ya salen en cuerpos del Friends FR A2 (candidatas a plaza). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; import { FRENCH_A1_A2_LEMMAS } from "../src/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const strip = (w: string) => w.toLowerCase().trim().replace(/^(le|la|les|un|une|des|du)\s+/, "").replace(/^l['’]/, "").replace(/^(se |s'|s’)/, "");
async function main() {
  const J = "cmu04ereh000732z7px7naqa2";
  const js = await p.journey.findMany({ where: { language: "french", status: { not: "archived" } }, select: { id: true } });
  const taught = new Set<string>();
  for (const j of js) for (const s of await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } })) for (const v of (s.vocab as any[]) ?? []) taught.add(strip(v.word));
  const rows = await p.journeyStory.findMany({ where: { journeyId: J }, select: { topic: true, slotIndex: true, text: true } });
  const toks = rows.map((r) => ({ k: `${r.topic.split("-")[0]}${r.slotIndex}`, t: new Set((r.text ?? "").toLowerCase().match(/\p{L}+/gu) ?? []) }));
  const out: string[] = [];
  for (const l of FRENCH_A1_A2_LEMMAS) { if (taught.has(l) || l.includes(" ") || l.length < 4) continue; const where = toks.filter((x) => x.t.has(l)).map((x) => x.k); if (where.length) out.push(`${l}(${where.length}:${where.join(",")})`); }
  console.log(out.sort((a, b) => Number(b.split("(")[1].split(":")[0]) - Number(a.split("(")[1].split(":")[0])).join("  "));
  await p.$disconnect();
}
main();
