/** Banda gramatical por historia, con TODOS los tokens: npx tsx scripts/_b2/_bandaPorHistoria.ts <fichero.json> */
import fs from "node:fs";
import { mide, BANDA_NIVEL } from "../_gramProbe";
for (const s of JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; text: string }>) {
  const { usos, tokens } = mide(s.text);
  console.log(s.slug + ": " + Object.keys(BANDA_NIVEL.b2).map((m) => `${m} ${usos[m]} [${tokens[m].join(" | ")}]`).join(" · "));
}
