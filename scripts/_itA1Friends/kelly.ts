// Solo lectura: por lema, nivel y categoria KELLY (referencia, fichero fuera del repo), si ya esta en
// italianA1A2, y si otro journey italiano lo ensena (y con que type).
//   npx tsx scripts/_itA1Friends/kelly.ts <kelly_it.json> <all.json> lema1 lema2 ...
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const kelly: Record<string, [string, string]> = JSON.parse(readFileSync(process.argv[2], "utf8"));
const d = JSON.parse(readFileSync(process.argv[3], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const tipos = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) { const k = strip(v.word); if (!tipos.has(k)) tipos.set(k, new Set()); tipos.get(k)!.add(`${v.type}@${j.name}${j.levels[0]}`); }
for (const w of process.argv.slice(4)) {
  const k = kelly[w];
  console.log(`${w.padEnd(16)} KELLY ${k ? k.join(" ") : "-"}  lista:${isItalianA1A2(w) ? "si" : "no"}  ${tipos.has(w) ? [...tipos.get(w)!].join("/") : ""}`);
}
