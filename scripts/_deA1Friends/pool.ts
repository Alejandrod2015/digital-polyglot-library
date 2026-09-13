// Solo lectura: lemas de la lista A1/A2 alemana que NINGUN journey aleman ensena todavia.
import { readFileSync, writeFileSync } from "fs";
import { GERMAN_A1_A2_LEMMAS } from "../../src/lib/cefr/germanA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OWN = "cmu0dqr6y0007j8o52i1s3gf7";
const taught = new Set<string>();
for (const j of d.journeys) { if (j.id === OWN) continue; for (const s of j.stories) for (const v of s.vocab ?? []) taught.add(String(v.word ?? "").toLowerCase().replace(/^(der|die|das|sich) /, "").trim()); }
const free = [...GERMAN_A1_A2_LEMMAS].filter((w) => !taught.has(w)).sort();
writeFileSync(process.argv[3], free.join("\n"));
console.log(free.length, "libres de", GERMAN_A1_A2_LEMMAS.size);
