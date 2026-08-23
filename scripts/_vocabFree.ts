/** Dice si una palabra ya la enseña otro journey de espanol, y en que cubo cae
 *  segun el tipo que elija el journey nuevo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const MI_TIPO = process.env.TIPO ?? "relationships";
async function main() {
  const words = process.argv.slice(2).flatMap((a) => a.split(/[,\s]+/)).filter(Boolean).map((w) => w.toLowerCase());
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } } },
    select: { vocab: true, journey: { select: { typeSlug: true, name: true, variant: true } } },
  });
  const duro = new Map<string, string>(); const blando = new Map<string, string>();
  for (const r of rows) {
    const same = r.journey?.typeSlug === MI_TIPO;
    for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) {
      if (!v?.word) continue;
      const w = String(v.word).toLowerCase();
      const tag = `${r.journey?.name}/${r.journey?.variant}`;
      if (same) duro.set(w, tag); else if (!blando.has(w)) blando.set(w, tag);
    }
  }
  let libres = 0, d = 0, b = 0;
  for (const w of words) {
    if (duro.has(w)) { console.log(`  DURO   ${w.padEnd(18)} ${duro.get(w)}`); d++; }
    else if (blando.has(w)) { console.log(`  blando ${w.padEnd(18)} ${blando.get(w)}`); b++; }
    else { console.log(`  libre  ${w}`); libres++; }
  }
  console.log(`\ntipo=${MI_TIPO} · libres ${libres} · DURO ${d} (tope 0) · blando ${b} (tope 2/historia)`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
