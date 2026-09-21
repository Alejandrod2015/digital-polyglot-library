/** Para una palabra candidata: nivel (lista A1A2) + si ya la ensena otro tipo aleman. */
import * as fs from "fs";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
const SP = process.env.SP!;
const t = JSON.parse(fs.readFileSync(`${SP}/taught.json`, "utf8"));
const lema = (w: string) => w.toLowerCase().replace(/^(der|die|das)\s+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const E = new Set((t.taughtElsewhere as string[]).map(lema));
for (const w of process.argv.slice(2)) {
  const flags = [isGermanA1A2(w) ? "" : "FUERA-NIVEL", E.has(lema(w)) ? "YA-ENSENADA" : ""].filter(Boolean);
  console.log(`${w.padEnd(24)} ${flags.length ? flags.join(" + ") : "ok"}`);
}
