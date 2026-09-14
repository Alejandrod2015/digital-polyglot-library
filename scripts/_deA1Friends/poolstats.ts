// Solo lectura: cuanto vocabulario de la lista A1/A2 queda libre, separando la capa portable de la anclada.
import { readFileSync } from "fs";
import { GERMAN_A1_A2_LEMMAS } from "../../src/lib/cefr/germanA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const norm = (w: string) => w.toLowerCase().replace(/^(der|die|das|sich) /, "").trim();
const all = new Map<string, string>(); const anchored = new Set<string>();
for (const j of d.journeys) for (const s of j.stories) for (const v of s.vocab ?? []) {
  const k = norm(v.word); all.set(k, v.type);
  if (!["verb", "adjective", "adverb", "expression"].includes(v.type)) anchored.add(k);
}
const L = [...GERMAN_A1_A2_LEMMAS];
console.log("lista:", L.length, "· libres contra TODO lo ensenado:", L.filter((w) => !all.has(w)).length, "· libres si la portable se reabre (solo cuenta lo anclado):", L.filter((w) => !anchored.has(w)).length);
