import { PORTUGUESE_A1_A2_LEMMAS } from "../src/lib/cefr/portugueseA1A2";
import fs from "fs";
const SC = process.argv[2];
const a0 = new Set((JSON.parse(fs.readFileSync(SC + "/a0words.json", "utf8")) as string[]).map((w) => w.toLowerCase()));
const usadas = new Set<string>();
for (const s of JSON.parse(fs.readFileSync(SC + "/hoy.json", "utf8")) as Array<{ topic: string; vocab: Array<{ word: string }> }>) {
  if (["belem", "pantanal", "ouro-preto", "olinda"].includes(s.topic)) continue;
  for (const v of s.vocab) usadas.add(String(v.word).toLowerCase());
}
for (const s of JSON.parse(fs.readFileSync(SC + "/lote.json", "utf8")) as Array<{ vocab: Array<{ word: string }> }>)
  for (const v of s.vocab) usadas.add(String(v.word).toLowerCase());
const libres = [...(PORTUGUESE_A1_A2_LEMMAS)].filter((w) => !a0.has(w) && !usadas.has(w));
console.log(libres.length + " libres:\n" + libres.join(" "));
