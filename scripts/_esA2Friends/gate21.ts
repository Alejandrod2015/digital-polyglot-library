// Solo lectura: gate de journey (validateJourneyStories) sobre las 21 historias de
// los JSON de tema que se pasan, en orden, con conjunto completo. Imprime cada check.
import fs from "node:fs";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const files = process.argv.slice(2);
const input = files.flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8"))).map((s: any, i: number) => ({ slug: `${s.topic}#${s.slotIndex}`, title: s.title, text: s.text, vocab: s.vocab, language: "ES", level: "A2", topic: s.topic }));
for (const c of validateJourneyStories(input, { language: "ES", level: "A2", realPeople: ["Zzzz"], conjuntoCompleto: true, journeyType: "relationships" }))
  console.log(`${c.status.padEnd(8)} ${c.id} ${c.detail ?? ""}`.slice(0, 260));
