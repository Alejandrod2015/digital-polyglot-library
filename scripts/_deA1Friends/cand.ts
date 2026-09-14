// Solo lectura: por cada palabra candidata, si esta en la lista A1/A2 y que journey aleman live+draft ya la ensena.
import { readFileSync } from "fs";
import { isGermanA1A2 } from "../../src/lib/cefr/germanA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const taught = new Map<string, Set<string>>();
for (const j of d.journeys) for (const s of j.stories) for (const v of s.vocab ?? []) {
  const k = String(v.word ?? "").toLowerCase().replace(/^(der|die|das|sich) /, "").trim();
  if (!taught.has(k)) taught.set(k, new Set());
  taught.get(k)!.add(`${j.name}-${j.levels[0]}`);
}
for (const line of readFileSync(process.argv[3], "utf8").split("\n").filter(Boolean)) {
  const [tema, ws] = line.split(":");
  const res = ws.trim().split(/\s+/).map((w) => {
    const t = taught.get(w.toLowerCase()); const lvl = isGermanA1A2(w) ? "" : "*";
    return t ? `~~${w}${lvl}~~(${[...t].join("/")})` : `${w}${lvl}`;
  });
  console.log(`${tema}: ${res.join(" ")}`);
}
