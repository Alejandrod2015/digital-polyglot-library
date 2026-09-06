import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
import * as fs from "fs";
const d = JSON.parse(fs.readFileSync(process.env.F!, "utf8"));
for (const s of d) {
  const fuera = (s.vocab as any[]).filter((v) => v.type !== "expression" && !["cultural","realia","slang","colloquial","vulgar"].includes(v.register ?? "") && !isPortugueseA1A2(v.word) && !isPortugueseB1Lemma(v.word)).map((v) => v.word);
  const parr = String(s.text).split("\n\n");
  const cnt = parr.map((p: string) => (s.vocab as any[]).filter((v) => p.includes(v.surface ?? v.word)).length);
  console.log(`${s.slug}\n   fuera de B1: ${fuera.join(" ") || "ninguna"}\n   por parrafo: ${cnt.join(", ")}`);
}
