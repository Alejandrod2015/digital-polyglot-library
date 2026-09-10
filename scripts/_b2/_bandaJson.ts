/** Banda gramatical B2 de un fichero de tema, sin tocar la base: la misma sonda
 *  que usa cierraTema, para medir antes de guardar.
 *    npx tsx scripts/_b2/_bandaJson.ts scripts/_b2/t1.json */
import fs from "node:fs";
import { mide, BANDA_NIVEL } from "../_gramProbe";

const arr = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string }>;
const { oraciones, usos, tokens } = mide(arr.map((s) => s.text).join("\n"));
for (const [m, [lo, hi]] of Object.entries(BANDA_NIVEL.b2)) {
  const fuera = usos[m] < lo || usos[m] > hi;
  console.log(`${fuera ? "FUERA" : "ok   "} ${m}: ${usos[m]} (${lo}-${hi}) · ${tokens[m].join(" | ") || "ninguno"}`);
}
console.log(`      ${oraciones} oraciones · pretérito ${usos["pretérito"]} · imperfecto ${usos["imperfecto"]}`);
