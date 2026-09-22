/** Para una palabra candidata: nivel + ya enseñada por otro tipo aleman + ya enseñada por ESTE journey. */
import * as fs from "fs";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
const SP = process.env.SP!;
const t = JSON.parse(fs.readFileSync(`${SP}/taught.json`, "utf8"));
const lema = (w: string) => w.toLowerCase().replace(/^(der|die|das)\s+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const E = new Set((t.taughtElsewhere as string[]).map(lema));
const M = new Set<string>();
for (const f of fs.readdirSync("scripts/_dea2")) {
  if (!/^t\d\.json$/.test(f)) continue;
  for (const s of JSON.parse(fs.readFileSync(`scripts/_dea2/${f}`, "utf8")))
    for (const v of s.vocab) M.add(lema(v.word));
}
for (const w of process.argv.slice(2)) {
  const n = lema(w);
  const flags = [isGermanA1A2(w) ? "" : "FUERA-NIVEL", E.has(n) ? "otro-tipo" : "", M.has(n) ? "YA-EN-ESTE-JOURNEY" : ""].filter(Boolean);
  console.log(`${w.padEnd(22)} ${flags.length ? flags.join(" + ") : "ok"}`);
}
