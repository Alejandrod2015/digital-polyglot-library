/** Filtra una lista de candidatos con el mismo criterio que el pre-check. */
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
const M = new Set<string>();
for (const f of fs.readdirSync("scripts/_dea2")) {
  if (!/^t\d\.json$/.test(f) || f === "t7.json") continue;
  for (const s of JSON.parse(fs.readFileSync(`scripts/_dea2/${f}`, "utf8")))
    for (const v of s.vocab) M.add(lema(v.word));
}
const ok: string[] = [], no: string[] = [];
for (const w of process.argv.slice(2)) {
  const n = lema(w);
  (isGermanA1A2(w) && !E.has(n) && !M.has(n) ? ok : no).push(w);
}
console.log("LIBRES:", ok.join(" · "));
console.log("\nNO:", no.join(" · "));
