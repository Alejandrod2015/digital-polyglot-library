// Solo lectura: por palabra, si esta en italianA1A2 y si ya la ensena otro journey italiano (y con que type).
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const tipos = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) {
    const k = strip(String(v.word)); if (!tipos.has(k)) tipos.set(k, new Set()); tipos.get(k)!.add(`${v.type}@${j.name}${j.levels[0]}`);
  }
const C: Record<string, string> = JSON.parse(readFileSync(process.argv[3], "utf8"));
for (const [t, ws] of Object.entries(C))
  console.log(`T${t}: ` + ws.split(",").map((x) => x.trim()).map((w) => `${w}${isItalianA1A2(w) ? "" : "*"}${tipos.has(strip(w)) ? "[" + [...tipos.get(strip(w))!].join("/") + "]" : ""}`).join(", "));
