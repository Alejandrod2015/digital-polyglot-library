// Solo lectura: tokens de cada cuerpo que estan en la lista A1/A2 y que ningun journey aleman (ni este, en otros temas) ensena.
// npx tsx scripts/_deA1Friends/pick.ts <tN-data.json> <de.json>
import { readFileSync, readdirSync } from "fs";
import { isGermanA1A2 } from "../../src/lib/cefr/germanA1A2";
const [file, dump] = process.argv.slice(2);
const d = JSON.parse(readFileSync(dump, "utf8"));
const norm = (w: string) => w.toLowerCase().replace(/^(der|die|das|sich) /, "").trim();
const taught = new Map<string, string>();
for (const j of d.journeys) { if (j.id === "cmu0dqr6y0007j8o52i1s3gf7") continue; for (const s of j.stories) for (const v of s.vocab ?? []) if (!["verb", "adjective", "adverb", "expression"].includes(v.type)) taught.set(norm(v.word), `${j.name}-${j.levels[0]}`); }
for (const f of readdirSync("scripts/_deA1Friends").filter((x) => /^t\d-data\.json$/.test(x) && `scripts/_deA1Friends/${x}` !== file))
  for (const s of JSON.parse(readFileSync(`scripts/_deA1Friends/${f}`, "utf8"))) for (const v of s.vocab) taught.set(norm(v.word), "ESTE");
const data = JSON.parse(readFileSync(file, "utf8"));
for (const s of data) {
  const toks = [...new Set<string>(s.text.match(/\p{L}+/gu))];
  const libres = toks.filter((t) => t.length > 2 && isGermanA1A2(t) && !taught.has(t.toLowerCase()));
  console.log(`\n## ${s.title}\n  libres+lista: ${libres.join(" ")}`);
}
