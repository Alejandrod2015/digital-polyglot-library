// Solo lectura: lemas de la lista A1/A2 libres para plaza en el Friends DE A1 (sin anclado ajeno ni lema propio).
import { readFileSync, readdirSync } from "fs";
import { GERMAN_A1_A2_LEMMAS } from "../../src/lib/cefr/germanA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const SEP = ["an", "auf", "aus", "ein", "nach", "vor", "zu", "ab", "mit", "bei", "ge", "ver", "be", "er", "ent"];
const sp = (w: string) => { let l = w.toLowerCase().replace(/^(der|die|das) /, ""); for (const p of SEP) if (l.startsWith(p) && l.length > p.length + 3) return l.slice(p.length); return l; };
const anc = new Set<string>();
for (const j of d.journeys) { if (j.id === "cmu0dqr6y0007j8o52i1s3gf7") continue; for (const s of j.stories) for (const v of s.vocab ?? []) if (!["verb", "adjective", "adverb", "expression"].includes(v.type)) anc.add(v.word.toLowerCase().replace(/^(der|die|das|sich) /, "")); }
const own = new Set<string>();
for (const f of readdirSync("scripts/_deA1Friends").filter((x) => /^t\d-data\.json$/.test(x))) for (const s of JSON.parse(readFileSync(`scripts/_deA1Friends/${f}`, "utf8"))) for (const v of s.vocab) own.add(sp(v.word));
console.log([...GERMAN_A1_A2_LEMMAS].filter((w) => w.length > 3 && !anc.has(w) && !own.has(sp(w)) && !own.has(w)).sort().join(" "));
