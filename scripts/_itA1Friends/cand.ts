// Solo lectura: cada candidata a plaza, libre o ya ensenada en otro journey italiano, y si esta en italianA1A2.
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const taught = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) {
    const k = strip(String(v.word)); if (!taught.has(k)) taught.set(k, new Set()); taught.get(k)!.add(`${j.name} ${j.levels[0]}`);
  }
const C: Record<string, string> = JSON.parse(readFileSync(process.argv[3], "utf8"));
for (const [t, ws] of Object.entries(C)) {
  const libres: string[] = [], ens: string[] = [];
  for (const w of ws.split(",").map((x) => x.trim())) {
    const tag = w + (isItalianA1A2(w) ? "" : "*");
    const k = strip(w);
    if (taught.has(k)) ens.push(`${tag} [${[...taught.get(k)!].join("/")}]`); else libres.push(tag);
  }
  console.log(`\n${t}\n  LIBRES: ${libres.join(", ")}\n  ENSENADAS: ${ens.join(", ")}`);
}
