/** Pre-check de un fichero de tema: nivel, solape con otros tipos y con este journey. */
import * as fs from "fs";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
const SP = process.env.SP!;
const SEP = ["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"];
const COM = ["ge","ver","be","er","ent"];
const lema = (w: string) => {
  let x = w.toLowerCase().replace(/^(der|die|das)\s+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  for (const p of [...SEP, ...COM]) if (x.startsWith(p) && x.length > p.length + 3) return x.slice(p.length);
  return x;
};
const t = JSON.parse(fs.readFileSync(`${SP}/taught.json`, "utf8"));
const E = new Set((t.taughtElsewhere as string[]).map(lema));
const target = process.argv[2];
const M = new Set<string>();
for (const f of fs.readdirSync("scripts/_dea2")) {
  if (!/^t\d\.json$/.test(f) || `scripts/_dea2/${f}` === target) continue;
  for (const s of JSON.parse(fs.readFileSync(`scripts/_dea2/${f}`, "utf8")))
    for (const v of s.vocab) M.add(lema(v.word));
}
for (const s of JSON.parse(fs.readFileSync(target, "utf8"))) {
  const seen = new Set<string>();
  let nivel = 0, otro = 0;
  const lines: string[] = [];
  for (const v of s.vocab) {
    const n = lema(v.word);
    const fl: string[] = [];
    if (!isGermanA1A2(v.word)) { fl.push("FUERA-NIVEL"); nivel++; }
    if (E.has(n)) { fl.push("otro-tipo"); otro++; }
    if (M.has(n)) fl.push("MISMO-JOURNEY(cero)");
    if (seen.has(n)) fl.push("DUP-EN-HISTORIA");
    seen.add(n);
    if (!(s.text as string).includes(v.surface)) fl.push("SURFACE-NO-ESTA");
    if (fl.length) lines.push(`   ${v.word.padEnd(22)} ${fl.join(" + ")}`);
  }
  console.log(`\n== ${s.slug}  items=${s.vocab.length} fuera-nivel=${nivel}(max2) otro-tipo=${otro}(max2)`);
  lines.forEach((l) => console.log(l));
}
