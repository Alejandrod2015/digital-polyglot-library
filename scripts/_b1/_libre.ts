/** ¿Estas palabras estan libres y dentro de B1? Filtro previo a escribir vocab. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
const libres = new Set<string>(JSON.parse(fs.readFileSync("scripts/_b1/_libres.json", "utf8")).map((w: string) => w.toLowerCase()));
const cand = process.argv.slice(2);
const si = cand.filter((w) => libres.has(w.toLowerCase()));
const no = cand.filter((w) => !libres.has(w.toLowerCase()));
console.log("LIBRES:", si.join(" "));
console.log("NO:", no.join(" "));
