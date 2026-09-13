/** Solo lectura (Friends FR B1): para cada candidata dice si esta en la lista FR A1-A2 de main y que journey frances no archivado ya la ensena. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; import { isFrenchA1A2 } from "../src/lib/cefr/frenchA1A2";
const p = new PrismaClient();
const strip = (w: string) => w.toLowerCase().trim().replace(/^(le|la|les|un|une|des|du)\s+/, "").replace(/^l['’]/, "").replace(/^(se |s'|s’)/, "");
async function main() {
  const js = await p.journey.findMany({ where: { language: "french", status: { not: "archived" } }, select: { id: true, name: true, levels: true } });
  const taught = new Map<string, string>();
  for (const j of js) { const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) taught.set(strip(v.word), `${j.name}-${j.levels[0]}:${v.type}`); }
  const cands = process.argv.slice(2).join(" ").split(",").map((s) => s.trim()).filter(Boolean);
  const fila = (c: string) => `${c}${isFrenchA1A2(c) ? "(A1A2)" : ""}${taught.has(strip(c)) ? `[${taught.get(strip(c))}]` : ""}`;
  console.log("LIBRES y B1:", cands.filter((c) => !taught.has(strip(c)) && !isFrenchA1A2(c)).join(", "));
  console.log("LIBRES pero A1A2:", cands.filter((c) => !taught.has(strip(c)) && isFrenchA1A2(c)).join(", "));
  console.log("YA ENSENADAS:", cands.filter((c) => taught.has(strip(c))).map(fila).join(", "));
  await p.$disconnect();
}
main();
