// Solo lectura: cuantas plazas por historia caen fuera de italianA1A2 en los journeys italianos.
import { readFileSync } from "fs";
import { isItalianA1A2 } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
for (const j of d.js.filter((j: any) => j.language === "italian")) {
  const outs = j.stories.filter((s: any) => s.vocab).map((s: any) => s.vocab.filter((v: any) => !isItalianA1A2(v.word)).length);
  console.log(j.name, j.levels[0], "fuera de lista por historia:", outs.join(","));
}
